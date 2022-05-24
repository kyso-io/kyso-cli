import { existsSync, readdirSync, readFileSync, lstatSync } from 'fs'
import { join } from 'path'
import ignore from 'ignore'

export const getValidFiles = (dirPath: string): string[] => {
  if (!existsSync(dirPath)) {
    throw new Error(`Folder ${dirPath} not found`)
  }
  const files: string[] = readdirSync(dirPath)
  const filesToIgnore: string[] = ['.git']
  for (const file of files) {
    if (file === '.gitignore' || file === '.kysoignore') {
      // Read content of file
      const content: string = readFileSync(join(dirPath, file), 'utf8').toString()
      // Split content into lines
      const lines: string[] = content.split('\n')
      // Remove empty lines
      const filteredLines: string[] = lines.filter(line => line.length > 0)
      // Add lines to ignored files if line is not in list
      for (const line of filteredLines) {
        // Check duplicates
        if (!filesToIgnore.includes(line)) {
          filesToIgnore.push(line)
        }
      }
    }
  }
  const ig = ignore().add(filesToIgnore)
  // Remove ignored files defined in .gitignore or .kysoignore
  const filteredFiles: string[] = files.filter(file => !ig.ignores(file))
  let validFiles: string[] = []
  for (const file of filteredFiles) {
    // For each file
    const filePath: string = join(dirPath, file)
    // Add to the valid files
    validFiles.push(filePath)
    // check if it is a directory
    if (lstatSync(filePath).isDirectory()) {
      // Recursive call
      const folderFiles = getValidFiles(filePath)
      validFiles = [...validFiles, ...folderFiles]
    }
  }
  return validFiles
}
