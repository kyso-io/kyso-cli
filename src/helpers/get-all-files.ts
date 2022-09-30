import { existsSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

export const getAllFiles = function (dirPath: string, arrayOfFiles: string[]): string[] {
  const files: string[] = readdirSync(dirPath)
  arrayOfFiles = arrayOfFiles || []
  for (const file of files) {
    if (file.startsWith('.') || file.endsWith('__MACOSX')) {
      continue
    }
    if (!existsSync(dirPath + '/' + file)) {
      continue
    }
    if (statSync(dirPath + '/' + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + '/' + file, arrayOfFiles)
    } else {
      arrayOfFiles.push(join(dirPath, '/', file))
    }
  }
  return arrayOfFiles
}
