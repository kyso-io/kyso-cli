import { Flags } from '@oclif/core'
import { launchInteractiveLoginIfNotLogged } from '../helpers/interactive-login'
import { KysoCommand } from './kyso-command'
import { existsSync, readdirSync, lstatSync, copyFileSync, mkdirSync, writeFileSync, rm, rmSync } from 'fs'
import { join } from 'path'
import AdmZip from 'adm-zip'
import convert = require('xml-js')
import { v4 as uuidv4 } from 'uuid';
const { exec, execSync } = require("child_process");

export default class ImportRepository extends KysoCommand {
  static description = 'Import report into kyso from different sources'

  static examples = [
    `$ kyso import --type powerpoint --path . --mappings Company:organization;Author:author;Keywords:team;Title:title;Comments:description`
  ]

  static flags = {
    type: Flags.string({
      char: 't',
      description: 'type',
      required: true,
      options: ["powerpoint"],
      default: "powerpoint"
    }),
    path: Flags.string({
      char: 'p',
      description: 'path',
      required: false,
      default: '.'
    }),
    mappings: Flags.string({
      char: 'm',
      description: 'mappings',
      required: false,
      default: "Company:organization;Creator:author;Keywords:team;Title:title;Comments:description"
    }),
    verbose: Flags.boolean({
      char: 'x',
      description: 'Verbose mode for debugging',
      required: false,
      default: false
    })
  }

  static args = []

  protected processFolder(startPath: string, extension: string, mappings: string) {
    if (!existsSync(startPath)) {
      this.error("Provided path does not exists");
    }

    const files = readdirSync(startPath);
    
    for (let i = 0; i < files.length; i++) {
        var filename = join(startPath, files[i]);
        var stat = lstatSync(filename);
        if (stat.isDirectory()) {
            this.processFolder(filename, extension, mappings); //recurse
        } else if (filename.endsWith(extension)) {
            console.log('🔎 Found: ', filename);
            const zip: AdmZip = new AdmZip(filename);
            const zipEntries = zip.getEntries();

            const app = zipEntries.filter(x => x.entryName === 'docProps/app.xml');
            const core = zipEntries.filter(x => x.entryName === 'docProps/core.xml');
            const thumbnail = zipEntries.filter(x => x.entryName === 'docProps/thumbnail.jpeg');
            
            const appJson = JSON.parse(convert.xml2json(app[0].getData().toString()));
            const coreJson = JSON.parse(convert.xml2json(core[0].getData().toString()));
            
            const appElements = appJson.elements.map(x => x.elements).flat();
            const coreElements = coreJson.elements.map(x => x.elements).flat();

            const allMetadata = [...coreElements, ...appElements];

            let keysFound = 0;
            const mappingObject = new Map();

            for(const metadata of allMetadata) {
              const mappingData = mappings.split(";");
              
              for(const mData of mappingData) {
                const splittedMap = mData.split(":");

                if(!mappingObject.has(splittedMap[0])) {
                  mappingObject.set(splittedMap[0], { kyso: splittedMap[1], value: undefined });
                }
              }
              
              for(const k of mappingObject.keys()) {
                if(metadata.name.toLowerCase().includes(k.toLowerCase())) {
                  // Match
                  if(metadata.elements) {
                    if(metadata.elements[0].type === "text") {
                      keysFound++;
                      console.log(`\t${keysFound}/${mappingObject.size} - ${mappingObject.get(k).kyso} is ${metadata.elements[0].text}`);
                      const data = mappingObject.get(k);

                      data.value = metadata.elements[0].text;
                      mappingObject.set(k, data);
                    }
                  }
                }
              }
            }

            let organizationSet = false;
            let organizationValue = "";
            let authorSet = false;
            let authorValue = "";
            let teamSet = false;
            let teamValue = "";
            let titleSet = false;
            let titleValue = "";

            // Check if minimum data is retrieved
            for (const [key, value] of mappingObject) {
              switch(value.kyso) {
                case "organization":
                  if(value.value) {
                    organizationSet = true;
                    organizationValue = value.value;
                  }
                  break;
                case "author":
                  if(value.value) {
                    authorSet = true;
                    authorValue = value.value;
                  }
                  break;
                case "team":
                  if(value.value) {
                    teamSet = true;
                    teamValue = value.value;
                  }
                  break;
                case "title":
                  if(value.value) {
                    titleSet = true;
                    titleValue = value.value;
                  }
                  break;
              }
            }

            if(organizationSet && authorSet && teamSet && titleSet) {
              // All right, upload it
              console.log("\t💚 All right! Uploading report...");

              const random = uuidv4();
              const tmpFolder = `${KysoCommand.DATA_DIRECTORY}/tmp/${random}`;

              mkdirSync(tmpFolder);
              
              // Copy file to a temporary folder
              const onlyName = filename.replace(/^.*[\\\/]/, '');
              copyFileSync(filename, `${tmpFolder}/${onlyName}`);

              // Create kyso.json
              const kysoJson = {
                main: onlyName,
                organization: organizationValue,
                team: teamValue, 
                authors: [authorValue],
                title: titleValue,
                description: "",
                type: "other"
              }

              writeFileSync(`${tmpFolder}/kyso.json`, JSON.stringify(kysoJson));

              // Call kyso push
              const result = execSync(`kyso push --path ${tmpFolder}`);
              console.log(result.toString());
            } else {
              console.log("\t💔 Sorry, we can't retrieve all the required metadata to upload this report");
            }
        };
    };
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(ImportRepository)

    if(flags.verbose) {
      this.log("Enabled verbose mode");
      this.enableVerbose();
    }

    await launchInteractiveLoginIfNotLogged();

    this.processFolder(flags.path, ".pptx", flags.mappings);
  }
}
