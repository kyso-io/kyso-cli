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
  team: string | null
}

export abstract class KysoCommand extends Command {
  private readonly DATA_DIRECTORY = join(homedir(), '.kyso')
  private tokenFilePath: string

  constructor(argv: string[], config: Config) {
    super(argv, config)
    this.tokenFilePath = join(this.DATA_DIRECTORY, 'auth.json')
  }

  private deleteTokenFile(): void {
    if (existsSync(this.tokenFilePath)) {
      unlinkSync(this.tokenFilePath)
    }
  }

  public saveToken(token: string, organization: string | null, team: string | null): void {
    mkdirSync(this.DATA_DIRECTORY, { recursive: true })
    const kysoCredentials: KysoCredentials = { token, organization, team }
    writeFileSync(this.tokenFilePath, JSON.stringify(kysoCredentials))
  }

  public async checkCredentials(): Promise<boolean> {
    // Check token validity
    if (existsSync(this.tokenFilePath)) {
      try {
        const kysoCredentials: KysoCredentials = JSON.parse(readFileSync(this.tokenFilePath, 'utf8').toString())
        const decoded: { payload: any; iat: number; exp: number } = jwtDecode(kysoCredentials.token)
        if (decoded.exp * 1000 >= new Date().getTime()) {
          (store as any).dispatch(setTokenAuthAction(kysoCredentials.token))
          (store as any).dispatch(setOrganizationAuthAction(kysoCredentials.organization))
          (store as any).dispatch(setTeamAuthAction(kysoCredentials.team))
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
