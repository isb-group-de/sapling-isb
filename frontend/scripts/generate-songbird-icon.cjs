/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('node:path')
const sharp = require('sharp')

const root = path.resolve(__dirname, '..')
const outputPath = path.join(root, 'src', 'assets', 'songbird-icon.png')
const size = 512
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">
  <g fill="#fff">
    <!-- Notenkopf: groß und rund, damit die Note auch bei Button-Größe lesbar bleibt. -->
    <ellipse cx="28" cy="72" rx="17.5" ry="12.5" transform="rotate(-18 28 72)" />

    <!-- Notenhals mit weicher Verbindung in Richtung Vogel. -->
    <rect x="39" y="30" width="10" height="43" rx="4.6" />
    <path d="M44 31 C49 32 54 36 59 41 C56 43 52 45 48 45 C44 44 41 42 39 40 L39 34 C40 32 42 31 44 31 Z" />

    <!-- Vogelkörper mit Schnabel: eine einfache Silhouette, nicht detailreich. -->
    <path d="M48 43 C58 35 70 33 82 39 C86 41 90 42 94 41 C91 44 88 47 84 49 C80 58 70 64 57 64 C50 64 44 62 39 58 C44 54 48 49 48 43 Z" />

    <!-- Großer Flügel: der musikalische Schwung geht in den Vogel über. -->
    <path d="M43 21 C57 26 68 34 76 45 C69 45 62 43 55 39 C49 35 44 29 43 21 Z" />

    <!-- Schwanzfedern, bewusst als zwei klare Zacken. -->
    <path d="M56 63 L43 82 L64 68 Z" />
    <path d="M65 62 L61 87 L75 66 Z" />
  </g>
</svg>`

sharp(Buffer.from(svg))
  .png()
  .toFile(outputPath)
  .then(() => console.log(outputPath))
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
