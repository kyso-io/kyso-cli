import { Helper } from '../../src/helpers/helper';

describe('Helper test suite', () => {
  describe('Sanitize URL function', () => {
    it('should sanitize a http://user:password@domain.com removing user and password', async () => {
      const url = 'http://user:password@dev.kyso.io';

      expect(Helper.sanitizeUrlBasicAuthentication(url)).toEqual('http://dev.kyso.io');
    });

    it('should sanitize a https://user:password@domain.com removing user and password', async () => {
      const url = 'https://user:password@dev.kyso.io';

      expect(Helper.sanitizeUrlBasicAuthentication(url)).toEqual('https://dev.kyso.io');
    });

    it('should sanitize a http://user:password@dev.kyso.io/moreUrl/specific_things removing user and password', async () => {
      const url = 'http://user:password@dev.kyso.io/moreUrl/specific_things';

      expect(Helper.sanitizeUrlBasicAuthentication(url)).toEqual('http://dev.kyso.io/moreUrl/specific_things');
    });

    it('should sanitize a http://user:password@dev.kyso.io/moreUrl/specific_things?hello=itsme&california=fuck:thisthing@calavera.com removing user and password', async () => {
      const url = 'http://user:password@dev.kyso.io/moreUrl/specific_things?hello=itsme&california=fuck:thisthing@calavera.com';

      expect(Helper.sanitizeUrlBasicAuthentication(url)).toEqual('http://dev.kyso.io/moreUrl/specific_things?hello=itsme&california=fuck:thisthing@calavera.com');
    });

    it('should return the same url if dont need sanitization', async () => {
      const url = 'https://dev.kyso.io/moreUrl/specific_things?hello=itsme';

      expect(Helper.sanitizeUrlBasicAuthentication(url)).toEqual('https://dev.kyso.io/moreUrl/specific_things?hello=itsme');
    });

    it('should return the same url if dont need sanitization even if some query parameters have the same structure', async () => {
      const url = 'https://dev.kyso.io/moreUrl/specific_things?hello=itsme&pa_joder=user:password@domain.com&pa_joder=//user:password@domain.com';

      expect(Helper.sanitizeUrlBasicAuthentication(url)).toEqual('https://dev.kyso.io/moreUrl/specific_things?hello=itsme&pa_joder=user:password@domain.com&pa_joder=//user:password@domain.com');
    });
  });

  describe('getValidFiles function', () => {
    it('should return a valid files for a relative single file test/helpers/getValidFilesResources/TestingSpark.ipynb', async () => {
      const expectedValue = [
        {
          path: `${__dirname}/getValidFilesResources/TestingSpark.ipynb`,
          sha: '8919c01c3220f71df6d8bd5b4a26df6effc8dbb439322736467fa7129761302d',
        },
      ];

      let receivedValue = Helper.getValidFiles('test/helpers/getValidFilesResources/TestingSpark.ipynb');
      expect(receivedValue).toEqual(expectedValue);

      receivedValue = Helper.getValidFiles('./test/helpers/getValidFilesResources/TestingSpark.ipynb');
      expect(receivedValue).toEqual(expectedValue);
    });

    it('should return a valid files for a relative single file ./test/helpers/getValidFilesResources/TestingSpark.ipynb', async () => {
      const expectedValue = [
        {
          path: `${__dirname}/getValidFilesResources/TestingSpark.ipynb`,
          sha: '8919c01c3220f71df6d8bd5b4a26df6effc8dbb439322736467fa7129761302d',
        },
      ];

      let receivedValue = Helper.getValidFiles('./test/helpers/getValidFilesResources/TestingSpark.ipynb');
      expect(receivedValue).toEqual(expectedValue);
    });

    it('should return a valid files for an absolute path single file __dirname + /getValidFilesResources/TestingSpark.ipynb', async () => {
      const expectedValue = [
        {
          path: `${__dirname}/getValidFilesResources/TestingSpark.ipynb`,
          sha: '8919c01c3220f71df6d8bd5b4a26df6effc8dbb439322736467fa7129761302d',
        },
      ];

      const finalPath = __dirname + '/getValidFilesResources/TestingSpark.ipynb';
      let receivedValue = Helper.getValidFiles(finalPath);
      expect(receivedValue).toEqual(expectedValue);
    });

    it('should return a valid files for a relative directory path ./test/helpers/getValidFilesResources/folderWithMultipleFiles', async () => {
      const expectedValue = [
        {
          path: `./test/helpers/getValidFilesResources/folderWithMultipleFiles/TestingSpark.ipynb`,
          sha: '8919c01c3220f71df6d8bd5b4a26df6effc8dbb439322736467fa7129761302d',
        },
        {
          path: `./test/helpers/getValidFilesResources/folderWithMultipleFiles/TestingSpark2.ipynb`,
          sha: '8919c01c3220f71df6d8bd5b4a26df6effc8dbb439322736467fa7129761302d',
        },
      ];

      let receivedValue = Helper.getValidFiles('./test/helpers/getValidFilesResources/folderWithMultipleFiles');
      expect(receivedValue).toEqual(expectedValue);
    });

    it('should return a valid files for a relative directory path ./test/helpers/getValidFilesResources/folderWithMultipleFiles/', async () => {
      const expectedValue = [
        {
          path: `./test/helpers/getValidFilesResources/folderWithMultipleFiles/TestingSpark.ipynb`,
          sha: '8919c01c3220f71df6d8bd5b4a26df6effc8dbb439322736467fa7129761302d',
        },
        {
          path: `./test/helpers/getValidFilesResources/folderWithMultipleFiles/TestingSpark2.ipynb`,
          sha: '8919c01c3220f71df6d8bd5b4a26df6effc8dbb439322736467fa7129761302d',
        },
      ];

      let receivedValue = Helper.getValidFiles('./test/helpers/getValidFilesResources/folderWithMultipleFiles/');
      expect(receivedValue).toEqual(expectedValue);
    });

    it('should return a valid files for an absolute directory path __dirname + /getValidFilesResources/folderWithMultipleFiles', async () => {
      const expectedValue = [
        {
          path: `${__dirname}/getValidFilesResources/folderWithMultipleFiles/TestingSpark.ipynb`,
          sha: '8919c01c3220f71df6d8bd5b4a26df6effc8dbb439322736467fa7129761302d',
        },
        {
          path: `${__dirname}/getValidFilesResources/folderWithMultipleFiles/TestingSpark2.ipynb`,
          sha: '8919c01c3220f71df6d8bd5b4a26df6effc8dbb439322736467fa7129761302d',
        },
      ];

      const finalPath = __dirname + '/getValidFilesResources/folderWithMultipleFiles';
      let receivedValue = Helper.getValidFiles(finalPath);
      expect(receivedValue).toEqual(expectedValue);
    });

    it('should return a valid files for an absolute directory path __dirname + /getValidFilesResources/folderWithMultipleFiles/', async () => {
      const expectedValue = [
        {
          path: `${__dirname}/getValidFilesResources/folderWithMultipleFiles/TestingSpark.ipynb`,
          sha: '8919c01c3220f71df6d8bd5b4a26df6effc8dbb439322736467fa7129761302d',
        },
        {
          path: `${__dirname}/getValidFilesResources/folderWithMultipleFiles/TestingSpark2.ipynb`,
          sha: '8919c01c3220f71df6d8bd5b4a26df6effc8dbb439322736467fa7129761302d',
        },
      ];

      const finalPath = __dirname + '/getValidFilesResources/folderWithMultipleFiles/';
      let receivedValue = Helper.getValidFiles(finalPath);
      expect(receivedValue).toEqual(expectedValue);
    });

    it('should return a valid files for a relative directory path ./test/helpers/getValidFilesResources/folderWithMultipleFilesAndGitIgnore ignoring files at .gitignore', async () => {
      const expectedValue = [
        {
          path: `./test/helpers/getValidFilesResources/folderWithMultipleFilesAndGitIgnore/TestingSpark.ipynb`,
          sha: '8919c01c3220f71df6d8bd5b4a26df6effc8dbb439322736467fa7129761302d',
        },
        // This is the ignored file
        // {
        //   path: `${__dirname}/getValidFilesResources/folderWithMultipleFilesAndGitIgnore/TestingSpark2.ipynb`,
        //   sha: '8919c01c3220f71df6d8bd5b4a26df6effc8dbb439322736467fa7129761302d',
        // }
      ];

      let receivedValue = Helper.getValidFiles('./test/helpers/getValidFilesResources/folderWithMultipleFilesAndGitIgnore');
      expect(receivedValue).toEqual(expectedValue);
    });

    it('should return a valid files for a absolute directory path __dirname + /getValidFilesResources/folderWithMultipleFilesAndGitIgnore ignoring files at .gitignore', async () => {
      const expectedValue = [
        {
          path: `${__dirname}/getValidFilesResources/folderWithMultipleFilesAndGitIgnore/TestingSpark.ipynb`,
          sha: '8919c01c3220f71df6d8bd5b4a26df6effc8dbb439322736467fa7129761302d',
        },
        // This is the ignored file
        // {
        //   path: `${__dirname}/getValidFilesResources/folderWithMultipleFilesAndGitIgnore/TestingSpark2.ipynb`,
        //   sha: '8919c01c3220f71df6d8bd5b4a26df6effc8dbb439322736467fa7129761302d',
        // }
      ];

      const finalPath = __dirname + '/getValidFilesResources/folderWithMultipleFilesAndGitIgnore/';
      let receivedValue = Helper.getValidFiles(finalPath);
      expect(receivedValue).toEqual(expectedValue);
    });

    it('should return a valid files for a relative directory path ./test/helpers/getValidFilesResources/folderWithMultipleFilesAndKysoIgnore ignoring files at .kysoignore', async () => {
      const expectedValue = [
        {
          path: `./test/helpers/getValidFilesResources/folderWithMultipleFilesAndKysoIgnore/TestingSpark.ipynb`,
          sha: '8919c01c3220f71df6d8bd5b4a26df6effc8dbb439322736467fa7129761302d',
        },
        // This is the ignored file
        // {
        //   path: `${__dirname}/getValidFilesResources/folderWithMultipleFilesAndGitIgnore/TestingSpark2.ipynb`,
        //   sha: '8919c01c3220f71df6d8bd5b4a26df6effc8dbb439322736467fa7129761302d',
        // }
      ];

      let receivedValue = Helper.getValidFiles('./test/helpers/getValidFilesResources/folderWithMultipleFilesAndKysoIgnore');
      expect(receivedValue).toEqual(expectedValue);
    });

    it('should return a valid files for a absolute directory path __dirname + /getValidFilesResources/folderWithMultipleFilesAndKysoIgnore ignoring files at .kysoignore', async () => {
      const expectedValue = [
        {
          path: `${__dirname}/getValidFilesResources/folderWithMultipleFilesAndKysoIgnore/TestingSpark.ipynb`,
          sha: '8919c01c3220f71df6d8bd5b4a26df6effc8dbb439322736467fa7129761302d',
        },
        // This is the ignored file
        // {
        //   path: `${__dirname}/getValidFilesResources/folderWithMultipleFilesAndGitIgnore/TestingSpark2.ipynb`,
        //   sha: '8919c01c3220f71df6d8bd5b4a26df6effc8dbb439322736467fa7129761302d',
        // }
      ];

      const finalPath = __dirname + '/getValidFilesResources/folderWithMultipleFilesAndKysoIgnore/';
      let receivedValue = Helper.getValidFiles(finalPath);
      expect(receivedValue).toEqual(expectedValue);
    });

    it('should return a valid files for a relative directory path ./test/helpers/getValidFilesResources/folderWithSubfolders with nested subfolders', async () => {
      const expectedValue = [
        {
          path: `./test/helpers/getValidFilesResources/folderWithSubfolders/TestingSpark.ipynb`,
          sha: '8919c01c3220f71df6d8bd5b4a26df6effc8dbb439322736467fa7129761302d',
        },
        {
          path: `./test/helpers/getValidFilesResources/folderWithSubfolders/subfolder1/TestingSpark.ipynb`,
          sha: '8919c01c3220f71df6d8bd5b4a26df6effc8dbb439322736467fa7129761302d',
        },
        {
          path: `./test/helpers/getValidFilesResources/folderWithSubfolders/subfolder1/subfolder1_2/TestingSpark.ipynb`,
          sha: '8919c01c3220f71df6d8bd5b4a26df6effc8dbb439322736467fa7129761302d',
        },
      ];

      let receivedValue = Helper.getValidFiles('./test/helpers/getValidFilesResources/folderWithSubfolders');
      expect(receivedValue).toEqual(expectedValue);
    });

    it('should return a valid files for a absolute directory path __dirname + /getValidFilesResources/folderWithSubfolders', async () => {
      const expectedValue = [
        {
          path: `${__dirname}/getValidFilesResources/folderWithSubfolders/TestingSpark.ipynb`,
          sha: '8919c01c3220f71df6d8bd5b4a26df6effc8dbb439322736467fa7129761302d',
        },
        {
          path: `${__dirname}/getValidFilesResources/folderWithSubfolders/subfolder1/TestingSpark.ipynb`,
          sha: '8919c01c3220f71df6d8bd5b4a26df6effc8dbb439322736467fa7129761302d',
        },
        {
          path: `${__dirname}/getValidFilesResources/folderWithSubfolders/subfolder1/subfolder1_2/TestingSpark.ipynb`,
          sha: '8919c01c3220f71df6d8bd5b4a26df6effc8dbb439322736467fa7129761302d',
        },
      ];

      const finalPath = __dirname + '/getValidFilesResources/folderWithSubfolders/';
      let receivedValue = Helper.getValidFiles(finalPath);
      expect(receivedValue).toEqual(expectedValue);
    });
  });
});
