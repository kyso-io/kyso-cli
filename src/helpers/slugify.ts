import slugify from 'slugify'

export default function slug(url: string): string {
  return slugify(url, {
    replacement: '-',
    lower: true,
    strict: true,
    trim: true,
  })
}
