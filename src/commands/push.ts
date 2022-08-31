/* eslint-disable no-await-in-loop */
import { KysoConfigFile, KysoSettingsEnum, NormalizedResponseDTO, Organization, ReportDTO, ReportPermissionsEnum, ResourcePermissions, TokenPermissions } from '@kyso-io/kyso-model'
import { Api, createKysoReportAction, setOrganizationAuthAction, setTeamAuthAction, store } from '@kyso-io/kyso-store'
import { Flags } from '@oclif/core'
import { existsSync, readdirSync, readFileSync } from 'fs'
import jwtDecode from 'jwt-decode'
import { isAbsolute, join } from 'path'
import { findKysoConfigFile } from '../helpers/find-kyso-config-file'
import { getAllFiles } from '../helpers/get-all-files'
import { getValidFiles } from '../helpers/get-valid-files'
import { launchInteractiveLoginIfNotLogged } from '../helpers/interactive-login'
import { KysoCredentials } from '../types/kyso-credentials'
import { KysoCommand } from './kyso-command'

export default class Push extends KysoCommand {
  static description = 'Upload local repository to Kyso'

  static examples = [`$ kyso push --path ./my-report`]

  static flags = {
    path: Flags.string({
      char: 'p',
      description: 'Path to root folder of the report to push. Default is "."',
      required: false,
      default: '.',
    }),
    verbose: Flags.boolean({
      char: 'x',
      description: 'Verbose mode for debugging',
      required: false,
      default: false,
    }),
  }

  static args = []

  private async uploadReportAux(basePath: string): Promise<void> {
    const kysoCredentials: KysoCredentials = KysoCommand.getCredentials()
    const api: Api = new Api(kysoCredentials.token)

    let files: string[] = getAllFiles(basePath, [])

    const { kysoConfigFile, valid, message } = findKysoConfigFile(files)
    if (!valid) {
      this.log(`\nError: Could not pull report using Kyso config file: ${message}\n`)
      return
    }

    const resultCheckPermission: NormalizedResponseDTO<boolean> = await api.checkPermission({
      organization: kysoConfigFile.organization,
      team: kysoConfigFile.team,
      permission: ReportPermissionsEnum.CREATE,
    })
    if (resultCheckPermission.data) {
      const { payload }: any = jwtDecode(kysoCredentials.token)
      const resultPermissions: NormalizedResponseDTO<TokenPermissions> = await api.getUserPermissions(payload.username)
      const tokenPermissions: TokenPermissions = resultPermissions.data
      const indexOrganization: number = tokenPermissions.organizations.findIndex(
        (resourcePermissionOrganization: ResourcePermissions) => resourcePermissionOrganization.name === kysoConfigFile.organization
      )
      if (indexOrganization === -1) {
        this.log(`\nError: You don't have permissions to create reports in organization ${kysoConfigFile.organization}\n`)
        return
      }
      const indexTeam: number = tokenPermissions.teams.findIndex((resourcePermissionTeam: ResourcePermissions) => resourcePermissionTeam.name === kysoConfigFile.team)
      if (indexTeam === -1) {
        this.log(`\nError: You don't have permissions to create reports in team ${kysoConfigFile.team}\n`)
        return
      }
    } else {
      let organization: Organization | null = null
      try {
        const resultOrganization: NormalizedResponseDTO<Organization> = await api.getOrganizationBySlug(kysoConfigFile.organization)
        organization = resultOrganization.data
      } catch {
        this.log(`\nError: Organization ${kysoConfigFile.organization} does not exist.\n`)
        return
      }
      try {
        await api.getTeamBySlug(organization.id, kysoConfigFile.team)
      } catch {
        this.log(`\nError: Team ${kysoConfigFile.team} does not exist.\n`)
        return
      }
      this.log(`\nError: You don't have permission to create reports in ${kysoConfigFile.team} of organization ${kysoConfigFile.organization}.\n`)
      return
    }

    if (kysoConfigFile?.organization && kysoConfigFile.organization.length > 0) {
      store.dispatch(setOrganizationAuthAction(kysoConfigFile.organization))
    }
    if (kysoConfigFile?.team && kysoConfigFile.team.length > 0) {
      store.dispatch(setTeamAuthAction(kysoConfigFile.team))
    }

    if (kysoConfigFile?.reports) {
      for (const reportFolderName of kysoConfigFile.reports) {
        const folderBasePath = join(basePath, reportFolderName)
        const folderFiles: string[] = getValidFiles(folderBasePath)
        files = [...files, ...folderFiles]
      }
    } else {
      files = getValidFiles(basePath)
    }

    const resultKysoSettings: NormalizedResponseDTO<string> = await api.getSettingValue(KysoSettingsEnum.MAX_FILE_SIZE)
    const result: any = await store.dispatch(
      createKysoReportAction({
        filePaths: files,
        basePath,
        maxFileSizeStr: resultKysoSettings.data || '500mb',
      })
    )
    const { error } = store.getState()
    if (error.text) {
      this.error(`\n😞 ${error.text}`)
    }
    if (result?.payload?.isAxiosError || result.payload === null) {
      this.error(`\n😞 Something went wrong. Please check the console log.`)
    } else {
      const kysoCredentials = JSON.parse(readFileSync(KysoCommand.tokenFilePath, 'utf8').toString())
      const normalizedResponse: NormalizedResponseDTO<ReportDTO | ReportDTO[]> = result.payload
      if (Array.isArray(normalizedResponse.data)) {
        for (const reportDto of normalizedResponse.data) {
          const reportUrl = `${kysoCredentials.kysoInstallUrl}/${reportDto.organization_sluglified_name}/${reportDto.team_sluglified_name}/${reportDto.name}`
          this.log(`🎉🎉🎉 Report ${reportDto.title} was uploaded to: ${reportUrl} 🎉🎉🎉\n`)
        }
      } else {
        const reportDto: ReportDTO = normalizedResponse.data
        const reportUrl = `${kysoCredentials.kysoInstallUrl}/${reportDto.organization_sluglified_name}/${reportDto.team_sluglified_name}/${reportDto.name}`
        this.log(`🎉🎉🎉 Report ${reportDto.title} was uploaded to: ${reportUrl} 🎉🎉🎉\n`)
      }
    }
  }

  private async uploadReport(basePath: string): Promise<void> {
    // Check if report is a multiple report
    let files: string[] = readdirSync(basePath).map((file: string) => join(basePath, file))
    let mainKysoConfigFile: KysoConfigFile | null = null
    const data: { kysoConfigFile: KysoConfigFile; valid: boolean; message: string } = findKysoConfigFile(files)
    if (!data.valid) {
      this.error(data.message)
    }
    mainKysoConfigFile = data.kysoConfigFile

    if (mainKysoConfigFile?.reports) {
      this.log(`\n${mainKysoConfigFile.reports.length} ${mainKysoConfigFile.reports.length > 1 ? 'reports' : 'report'} found\n`)
      for (const reportFolder of mainKysoConfigFile.reports) {
        // Check if folder exists
        const reportPath: string = join(basePath, reportFolder)
        if (!existsSync(reportPath)) {
          this.error(`Report folder ${reportFolder} does not exist.`)
        }
        files = getAllFiles(reportPath, [])
        const { valid, message } = findKysoConfigFile(files)
        if (!valid) {
          this.error(`Folder ${reportFolder} does not have a valid Kyso config file. ${message}`)
        }
        await this.uploadReportAux(reportPath)
      }
    } else {
      const parts: string[] = basePath.split('/')
      const folderName: string = parts[parts.length - 1]
      this.log(`Uploading report '${folderName}'`)
      await this.uploadReportAux(basePath)
    }
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(Push)

    if (flags.verbose) {
      this.log('Enabled verbose mode')
      this.enableVerbose()
    }

    await launchInteractiveLoginIfNotLogged()

    if (!existsSync(flags.path)) {
      this.error('Invalid path')
    }

    const basePath: string = isAbsolute(flags.path) ? flags.path : join('.', flags.path)
    await this.uploadReport(basePath)

    if (flags.verbose) {
      this.log('Disabling verbose mode')
      this.disableVerbose()
    }
  }
}
