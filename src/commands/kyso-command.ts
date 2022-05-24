/* eslint-disable max-params */
import { setOrganizationAuthAction, setTeamAuthAction, setTokenAuthAction, store } from '@kyso-io/kyso-store'
import { Command, Config } from '@oclif/core'
import * as dotenv from 'dotenv'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import jwtDecode from 'jwt-decode'
import { homedir } from 'os'
import { join } from 'path'

dotenv.config({
  // eslint-disable-next-line unicorn/prefer-module
  path: join(__dirname, '../../.env'),
})

interface KysoCredentials {
  token: string
  organization: string | null
  team: string | null,
  kysoInstallUrl: string | null,
  username: string | null
}

export abstract class KysoCommand extends Command {
  private readonly DATA_DIRECTORY = join(homedir(), '.kyso')
  public tokenFilePath: string

  constructor(argv: string[], config: Config) {
    super(argv, config)
    this.tokenFilePath = join(this.DATA_DIRECTORY, 'auth.json')
  }

  private deleteTokenFile(): void {
    if (existsSync(this.tokenFilePath)) {
      unlinkSync(this.tokenFilePath)
    }
  }

  public saveToken(token: string, organization: string | null, team: string | null, kysoInstallUrl?: string | null, username?: string | null): void {
    mkdirSync(this.DATA_DIRECTORY, { recursive: true })
    const kysoCredentials: KysoCredentials = { token, organization, team, kysoInstallUrl, username }
    writeFileSync(this.tokenFilePath, JSON.stringify(kysoCredentials))
  }

  public async checkCredentials(): Promise<boolean> {
    // Check token validity
    if (existsSync(this.tokenFilePath)) {
      try {
        const kysoCredentials: KysoCredentials = JSON.parse(readFileSync(this.tokenFilePath, 'utf8').toString())

        // hack hack hack - check with fran
        if (kysoCredentials.kysoInstallUrl) process.env.KYSO_API = `${kysoCredentials.kysoInstallUrl}/api/v1`

        const decoded: { payload: any; iat: number; exp: number } = jwtDecode(kysoCredentials.token)
        if (decoded.exp * 1000 >= new Date().getTime()) {
          store.dispatch(setTokenAuthAction(kysoCredentials.token))
          store.dispatch(setOrganizationAuthAction(kysoCredentials.organization))
          store.dispatch(setTeamAuthAction(kysoCredentials.team))
          return true
        }
        this.deleteTokenFile()
        // this.error('Session expired. Login again.')
      } catch {
        this.deleteTokenFile()
        // this.error('Invalid auth.json')
      }
    } else {
      // this.error('Sign in to Kyso.')
    }
    return false
  }
}
