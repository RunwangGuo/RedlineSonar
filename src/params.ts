import process from 'process'

export class IParams {
    pipelineID!: number

    pipelineName!: string

    buildNumber?: number

    workSpace!: string

    projectDir!: string

    buildJobID!: number

    sonarHost!: string

    sonarToken!: string

    sonarProjectKey!: string
}

export function getParams(): IParams {
    let params = new IParams()
    params.pipelineID = Number(process.env.PIPELINE_ID)
    params.pipelineName = process.env.PIPELINE_NAME as string
    params.buildNumber = Number(process.env.BUILD_NUMBER)
    params.workSpace = process.env.WORK_SPACE as string
    params.projectDir = process.env.PROJECT_DIR as string
    params.buildJobID = Number(process.env.BUILD_JOB_ID)
    params.sonarHost = process.env.STEP_SONAR_HOST ? process.env.STEP_SONAR_HOST as string : ''
    params.sonarToken = process.env.STEP_SONAR_TOKEN ? process.env.STEP_SONAR_TOKEN as string : ''
    params.sonarProjectKey = process.env.STEP_SONAR_PROJECT_KEY ? process.env.STEP_SONAR_PROJECT_KEY as string : ''
    return params
}