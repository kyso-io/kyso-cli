/* eslint-disable max-params */
import { setOrganizationAuthAction, setTeamAuthAction, setTokenAuthAction, store } from '@kyso-io/kyso-store'
import { Command, Config } from '@oclif/core'
import * as dotenv from 'dotenv'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import jwtDecode from 'jwt-decode'
import { homedir } from 'os'
import { join } from 'path'
import { CheckCredentialsResultEnum } from '../types/check-credentials-result.enum'
import { KysoCredentials } from '../types/kyso-credentials'

dotenv.config({
  // eslint-disable-next-line unicorn/prefer-module
  path: join(__dirname, '../../.env'),
})

export abstract class KysoCommand extends Command {
  protected static readonly DATA_DIRECTORY = process.env.KYSO_DATA_DIRECTORY ? process.env.KYSO_DATA_DIRECTORY : join(homedir(), '.kyso')

  public static tokenFilePath: string = join(this.DATA_DIRECTORY, 'auth.json')
  private verbose: boolean
  private previousKysoCliVerbose = process.env.KYSO_CLI_VERBOSE

  constructor(argv: string[], config: Config) {
    super(argv, config)
    this.verbose = false
  }

  public enableVerbose(): void {
    this.previousKysoCliVerbose = process.env.KYSO_CLI_VERBOSE
    this.verbose = true
    process.env.KYSO_CLI_VERBOSE = 'true'
  }

  public disableVerbose(): void {
    this.verbose = false
    process.env.KYSO_CLI_VERBOSE = this.previousKysoCliVerbose
  }

  public static removeCredentials(): void {
    if (existsSync(this.tokenFilePath)) {
      unlinkSync(this.tokenFilePath)
    }
  }

  public static getCredentials(): KysoCredentials {
    return existsSync(this.tokenFilePath) ? JSON.parse(readFileSync(this.tokenFilePath, 'utf8').toString()) : null
  }

  public static saveToken(token: string, organization: string | null, team: string | null, kysoInstallUrl?: string | null, username?: string | null, fixedKysoInstallUrl?: string | null): void {
    mkdirSync(this.DATA_DIRECTORY, { recursive: true })
    const kysoCredentials: KysoCredentials = { token, organization, team, kysoInstallUrl, username, fixedKysoInstallUrl }
    writeFileSync(this.tokenFilePath, JSON.stringify(kysoCredentials))
  }

  public static async checkCredentials(): Promise<CheckCredentialsResultEnum> {
    const kysoCredentials: KysoCredentials = this.getCredentials()
    if (!kysoCredentials) {
      return CheckCredentialsResultEnum.NOT_EXIST
    }
    try {
      if (kysoCredentials.kysoInstallUrl) {
        process.env.KYSO_API = `${kysoCredentials.kysoInstallUrl}/api/v1`
      }
      // Check token validity
      const decoded: { payload: any; iat: number; exp: number } = jwtDecode(kysoCredentials.token)

      if (decoded.exp * 1000 >= new Date().getTime()) {
        store.dispatch(setTokenAuthAction(kysoCredentials.token))
        store.dispatch(setOrganizationAuthAction(kysoCredentials.organization))
        store.dispatch(setTeamAuthAction(kysoCredentials.team))

        return CheckCredentialsResultEnum.VALID
      }
    } catch {}

    return CheckCredentialsResultEnum.EXPIRED_TOKEN
    // this.removeCredentials(kysoCredentials)
  }
}
