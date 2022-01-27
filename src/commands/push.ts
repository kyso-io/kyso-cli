import { Flags } from '@oclif/core'
import * as AdmZip from 'adm-zip'
import axios, { AxiosResponse } from 'axios'
import * as FormData from 'form-data'
import { createReadStream, readdirSync, readFileSync, statSync, unlinkSync } from 'fs'
import { join } from 'path'
import * as sha256File from 'sha256-file'
import { KysoConfig } from '../interfaces/kyso-config'
import { KysoCommand } from './kyso-command'

const token =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwYXlsb2FkIjp7ImlkIjoiNjFmMTE0N2Q1OTM0MTA5NTY4OGNkMDRmIiwibmlja25hbWUiOiJwYWxwYXRpbmUiLCJ1c2VybmFtZSI6InBhbHBhdGluZUBreXNvLmlvIiwiZW1haWwiOiJwYWxwYXRpbmVAa3lzby5pbyIsInBsYW4iOiJmcmVlIiwicGVybWlzc2lvbnMiOnsiZ2xvYmFsIjpbIktZU09fSU9fR0VORVJBTF9HTE9CQUxfQURNSU4iXSwidGVhbXMiOlt7Im5hbWUiOiJQYWxwYXRpbmUncyBQcml2YXRlIiwiaWQiOiI2MWYxMTQ3ZDU5MzQxMDk1Njg4Y2QwNTIiLCJwZXJtaXNzaW9ucyI6WyJLWVNPX0lPX0FETUlOX0NPTU1FTlQiLCJLWVNPX0lPX0NSRUFURV9DT01NRU5UIiwiS1lTT19JT19ERUxFVEVfQ09NTUVOVCIsIktZU09fSU9fRURJVF9DT01NRU5UIiwiS1lTT19JT19SRUFEX0NPTU1FTlQiLCJLWVNPX0lPX0FETUlOX0dJVEhVQl9SRVBPIiwiS1lTT19JT19DUkVBVEVfR0lUSFVCX1JFUE8iLCJLWVNPX0lPX0RFTEVURV9HSVRIVUJfUkVQTyIsIktZU09fSU9fRURJVF9HSVRIVUJfUkVQTyIsIktZU09fSU9fUkVBRF9HSVRIVUJfUkVQTyIsIktZU09fSU9fUkVBRF9PUkdBTklaQVRJT04iLCJLWVNPX0lPX0FETUlOX1JFUE9SVCIsIktZU09fSU9fQ1JFQVRFX1JFUE9SVCIsIktZU09fSU9fREVMRVRFX1JFUE9SVCIsIktZU09fSU9fRURJVF9SRVBPUlQiLCJLWVNPX0lPX1JFQURfUkVQT1JUIiwiS1lTT19JT19BRE1JTl9URUFNIiwiS1lTT19JT19FRElUX1RFQU0iLCJLWVNPX0lPX1JFQURfVEVBTSIsIktZU09fSU9fRURJVF9VU0VSIiwiS1lTT19JT19SRUFEX1VTRVIiXSwib3JnYW5pemF0aW9uX2lkIjoiNjFmMTE0N2Q1OTM0MTA5NTY4OGNkMDUwIn1dLCJvcmdhbml6YXRpb25zIjpbeyJpZCI6IjYxZjExNDdkNTkzNDEwOTU2ODhjZDA1MCIsIm5hbWUiOiJQYWxwYXRpbmUncyBXb3Jrc3BhY2UiLCJwZXJtaXNzaW9ucyI6WyJLWVNPX0lPX0FETUlOX0NPTU1FTlQiLCJLWVNPX0lPX0NSRUFURV9DT01NRU5UIiwiS1lTT19JT19ERUxFVEVfQ09NTUVOVCIsIktZU09fSU9fRURJVF9DT01NRU5UIiwiS1lTT19JT19SRUFEX0NPTU1FTlQiLCJLWVNPX0lPX0FETUlOX0dJVEhVQl9SRVBPIiwiS1lTT19JT19DUkVBVEVfR0lUSFVCX1JFUE8iLCJLWVNPX0lPX0RFTEVURV9HSVRIVUJfUkVQTyIsIktZU09fSU9fRURJVF9HSVRIVUJfUkVQTyIsIktZU09fSU9fUkVBRF9HSVRIVUJfUkVQTyIsIktZU09fSU9fQURNSU5fT1JHQU5JWkFUSU9OIiwiS1lTT19JT19DUkVBVEVfT1JHQU5JWkFUSU9OIiwiS1lTT19JT19ERUxFVEVfT1JHQU5JWkFUSU9OIiwiS1lTT19JT19FRElUX09SR0FOSVpBVElPTiIsIktZU09fSU9fUkVBRF9PUkdBTklaQVRJT04iLCJLWVNPX0lPX0FETUlOX1JFUE9SVCIsIktZU09fSU9fQ1JFQVRFX1JFUE9SVCIsIktZU09fSU9fREVMRVRFX1JFUE9SVCIsIktZU09fSU9fRURJVF9SRVBPUlQiLCJLWVNPX0lPX1JFQURfUkVQT1JUIiwiS1lTT19JT19BRE1JTl9URUFNIiwiS1lTT19JT19DUkVBVEVfVEVBTSIsIktZU09fSU9fREVMRVRFX1RFQU0iLCJLWVNPX0lPX0VESVRfVEVBTSIsIktZU09fSU9fUkVBRF9URUFNIiwiS1lTT19JT19DUkVBVEVfVVNFUiIsIktZU09fSU9fREVMRVRFX1VTRVIiLCJLWVNPX0lPX0VESVRfVVNFUiIsIktZU09fSU9fUkVBRF9VU0VSIl19XX0sImF2YXRhcl91cmwiOiJodHRwczovL2JpdC5seS8zZTliOWVwIn0sImlhdCI6MTY0MzI4ODA1OSwiZXhwIjoxNjQzMjk1MjU5LCJpc3MiOiJreXNvIn0.yTkM2sOBzfJROB4G0-JypVTuU_Dm_65zYK1sKIoquUc'

const getAllFiles = function (dirPath: string, arrayOfFiles: string[]): string[] {
  const files: string[] = readdirSync(dirPath)
  arrayOfFiles = arrayOfFiles || []
  for (const file of files) {
    if (file.endsWith('.git') || file.endsWith('.ipynb_checkpoints')) {
      continue
    }
    if (statSync(dirPath + '/' + file).isDirectory()) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      arrayOfFiles = getAllFiles(dirPath + '/' + file, arrayOfFiles)
    } else {
      // eslint-disable-next-line unicorn/prefer-module
      arrayOfFiles.push(join(dirPath, '/', file))
    }
  }
  return arrayOfFiles
}

export default class Push extends KysoCommand {
  static description = 'Make login request to the server'

  static examples = [`$ kyso push --name <name> --main <main file path>`]

  static flags = {
    path: Flags.string({
      char: 'p',
      description: 'path',
      required: false,
      default: '.',
    }),
  }

  static args = []

  async run(): Promise<void> {
    const { flags } = await this.parse(Push)
    let files: string[] = getAllFiles(flags.path, [])

    const index: number = files.findIndex((file: string) => file.endsWith('kyso.json'))
    if (index === -1) {
      this.error('kyso.json not found')
    }
    const kysoConfig: KysoConfig = JSON.parse(readFileSync(files[index], 'utf8').toString())
    const gitIgnores: any[] = files.filter((file: string) => file.endsWith('.gitignore'))
    let ignoredFiles: string[] = []
    for (const gitIgnore of gitIgnores) {
      const ifs: string[] = readFileSync(gitIgnore, 'utf8').toString().split('\n')
      // Delete empty lines
      ignoredFiles = [...ignoredFiles, ...ifs.filter((file: string) => file.length > 0)]
    }
    files = files.filter((file: string) => {
      for (const ignoredFile of ignoredFiles) {
        if (file.endsWith(ignoredFile)) {
          return false
        }
      }
      return true
    })

    // Move this code into kyso-store
    const formData = new FormData()
    formData.append('title', kysoConfig.title)
    formData.append('description', kysoConfig.description)
    formData.append('organization', kysoConfig.organization)
    formData.append('team', kysoConfig.team)

    const zipedFiles: string[] = []
    for (const file of files) {
      const zip = new AdmZip()
      const sha: string = sha256File(file)
      const content: Buffer = readFileSync(file)
      const filename = flags?.path ? file.replace(flags.path + '/', '') : file
      zip.addFile(filename, content)
      const outputFilePath = `/tmp/${filename}.zip`
      zip.writeZip(outputFilePath)
      zipedFiles.push(outputFilePath)
      formData.append('files', createReadStream(outputFilePath), {
        filename,
        knownLength: statSync(outputFilePath).size,
      })
      formData.append('original_shas', sha)
      formData.append('original_sizes', statSync(file).size)
      formData.append('original_names', filename)
    }

    this.log('Uploading report. Wait...')
    try {
      const axiosResponse: AxiosResponse<any> = await axios.post('http://localhost:4000/v1/reports/kyso', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...formData.getHeaders(),
          'content-length': formData.getLengthSync(),
        },
      })
      this.log(axiosResponse.data)
    } catch (error: any) {
      this.error(error)
    } finally {
      // Delete zip files
      for (const zipedFile of zipedFiles) {
        unlinkSync(zipedFile)
      }
    }
  }
}
