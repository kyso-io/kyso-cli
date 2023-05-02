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
});
