import * as step from '@flow-step/step-toolkit'
import {RedlineInfo, RedlineResult} from "@flow-step/step-toolkit/lib/redline";
import * as redline from "@flow-step/step-toolkit/lib/redline";
import process from 'process'
import {getParams, IParams} from './params'
import axios, {AxiosError} from "axios";

function logAndValidParams(params: IParams) {
    step.info(`PIPELINE_ID=${params.pipelineID}`)
    step.info(`PIPELINE_NAME=${params.pipelineName}`)
    step.info(`BUILD_NUMBER=${params.buildNumber}`)
    step.info(`WORK_SPACE=${params.workSpace}`)
    step.info(`PROJECT_DIR=${params.projectDir}`)
    step.info(`BUILD_JOB_ID=${params.buildJobID}`)
    step.info(`SONAR_HOST=${params.sonarHost}`)
    step.info(`SONAR_PROJECT_KEY=${params.sonarProjectKey}`)

    if (params.sonarHost === '' || params.sonarProjectKey === '') {
        throw new Error('sonarHost or sonarProjectKey is empty')
    }
    step.debug(`SONAR_TOKEN=${params.sonarToken}`)
}

async function runStep(): Promise<void> {
    const params = getParams()
    // 输出基础信息和检验入参
    logAndValidParams(params);

    // 调用 sonar api 获取指定项目的指标数据
    const metrics = await requestSonarMetrics(`${params.sonarHost}/api/measures/search`, params.sonarToken, {
        projectKeys: `${params.sonarProjectKey}`,
        metricKeys: 'alert_status,bugs,reliability_rating,vulnerabilities,security_rating,code_smells,sqale_rating,duplicated_lines_density,coverage,ncloc,ncloc_language_distribution'
    })
    step.infoCyan(`Sonar Metrics: ${JSON.stringify(metrics)}`)

    const bugs = Number(metrics['bugs'])
    const vulnerabilities = Number(metrics['vulnerabilities'])
    const smells = Number(metrics['code_smells'])
    const coverage = Number(metrics['coverage'])

    // 准备红线数据
    const readlineResults = [] as RedlineResult[]
    const bugsRR = generateRedlineResult("Bugs", "缺陷", bugs, redline.Error);
    readlineResults.push(bugsRR)

    const vulnerabilitiesRR = generateRedlineResult("Vulnerabilities", "漏洞", vulnerabilities, redline.Error);
    readlineResults.push(vulnerabilitiesRR)

    const smellsRR = generateRedlineResult("Smells", "坏味道", smells, redline.Error);
    readlineResults.push(smellsRR)

    const coverageRR = generateRedlineResult("Coverage", "覆盖率", coverage, redline.Warning);
    readlineResults.push(coverageRR)

    // 调用 sdk 进行红线检验和记录报告链接信息
    const redlineInfo = {} as RedlineInfo
    redlineInfo.title = 'Redline Sonar'
    redlineInfo.reportUrl = `${params.sonarHost}/component_measures?id=${params.sonarProjectKey}`
    redlineInfo.readlineResults = readlineResults
    step.redline.redlineCheck(redlineInfo, process.env['CHECK_REDLINES'])
}

/**
 * 将指标数据转换为红线数据
 *
 * @param key 和step.yaml中红线定义的key一致
 * @param title 字段名称
 * @param value 字段值
 * @param style Error: 红色，Warning: 橙色，Default: 灰色
 */
function generateRedlineResult(key: string, title: string, value: number, style: string) {
    const redlineResult = {} as RedlineResult
    redlineResult.key = key
    redlineResult.title = title
    redlineResult.value = value
    redlineResult.style = style
    return redlineResult;
}

/**
 * 请求 sonar api
 * @param url
 * @param token
 * @param params
 */
async function requestSonarMetrics(url: string, token: string, params: any): Promise<Record<string, string>> {
    step.infoCyan(`request sonar metrics from ${url} with params ${JSON.stringify(params)} `)
    try {
        const axiosHeaders = new axios.AxiosHeaders()
        // public repo don't need token
        if (token !== '') {
            axiosHeaders.set('Authorization', `Bearer ${token}`)
        }

        const response = await axios.request({
            method: 'GET',
            headers: axiosHeaders,
            url: url,
            params: params
        });

        const measures = response.data.measures;
        const formattedMetrics: Record<string, string> = {};
        measures.forEach((measure: any) => {
            formattedMetrics[measure.metric] = measure.value;
        });

        return formattedMetrics;

    } catch (error) {
        const axiosError = error as AxiosError;
        throw new Error(`error: ${axiosError.code} ${axiosError.message} ${JSON.stringify(axiosError.response?.data)}`);
    }
}

runStep()
    .then(function () {
        step.success('run step successfully!')
    })
    .catch(function (err: Error) {
        step.error(err.message)
        process.exit(-1)
    })
