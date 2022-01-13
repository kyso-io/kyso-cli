import { Command, Config } from '@oclif/core'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import jwtDecode from 'jwt-decode'
import { setToken, store } from 'kyso-store'
import { homedir } from 'os'
import { join } from 'path'

export abstract class KysoCommand extends Command {
  private readonly DATA_DIRECTORY = join(homedir(), '.kyso')
  private tokenFilePath: string

  constructor(argv: string[], config: Config) {
    super(argv, config)
    this.tokenFilePath = join(this.DATA_DIRECTORY, 'token')
  }

  private deleteTokenFile(): void {
    if (existsSync(this.tokenFilePath)) {
      unlinkSync(this.tokenFilePath)
    }
  }

  public saveToken(token: string): void {
    mkdirSync(this.DATA_DIRECTORY, { recursive: true })
    writeFileSync(this.tokenFilePath, token)
  }

  public async checkCredentials(): Promise<void> {
    // Check token validity
    if (existsSync(this.tokenFilePath)) {
      const token: string = readFileSync(this.tokenFilePath, 'utf8').toString()
      const decoded: { payload: any; iat: number; exp: number } = jwtDecode(token)
      if (decoded.exp * 1000 >= new Date().getTime()) {
        store.dispatch(setToken(token))
        return
      }
      this.deleteTokenFile()
      this.error('Session expired. Login again.')
    } else {
      this.error('Sign in to Kyso.')
    }
  }
}
