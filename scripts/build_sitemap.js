#!/usr/bin/env node
// ============================================================================
// Gera o sitemap.xml a partir dos arquivos que EXISTEM no disco.
// ============================================================================
// Rodar na raiz do repositório:  node scripts/build_sitemap.js
// Confere sem escrever:          node scripts/build_sitemap.js --check
//
// POR QUE GERAR EM VEZ DE ESCREVER À MÃO: lista escrita à mão envelhece calada.
// Página nova fica de fora, página removida continua listada, e nada avisa —
// o Google só descobre errando.
//
// ⚠️ ESTE ARQUIVO JÁ FOI PROMETIDO E NÃO EXISTIA. O cabeçalho do sitemap dizia
// "Gerado por scripts/build_sitemap.js" desde agosto, mas o script tinha ficado
// numa pasta temporária de outra sessão e se perdeu. Duas edições seguintes
// foram feitas à mão. Se você está lendo isto, ele existe de novo — mantenha-o
// no repositório.
// ============================================================================

const fs = require('fs');
const path = require('path');

const BASE = 'https://stormstock.app';
const RAIZ = path.resolve(__dirname, '..');
const CHECK = process.argv.includes('--check');

// ---------------------------------------------------------------------------
// Grupos de idioma: cada linha é a MESMA página em en/pt/es.
// ---------------------------------------------------------------------------
// ⚠️ Os slugs são DIFERENTES por idioma de propósito — quem busca em português
// digita em português, e a URL faz parte do que casa com a busca. Por isso o
// mapa é explícito: não dá pra derivar "kit-de-emergencia-para-furacao" de
// "hurricane-kit" por regra nenhuma.
const GRUPOS = [
  { en: '', pt: 'pt', es: 'es', freq: 'weekly', prio: '1.0' },
  { en: 'prepare', pt: 'pt/como-se-preparar-para-um-furacao', es: 'es/como-prepararse-para-un-huracan', freq: 'monthly', prio: '0.9' },
  { en: 'during', pt: 'pt/o-que-fazer-durante-um-furacao', es: 'es/que-hacer-durante-un-huracan', freq: 'monthly', prio: '0.9' },
  { en: 'after', pt: 'pt/o-que-fazer-depois-do-furacao', es: 'es/que-hacer-despues-de-un-huracan', freq: 'monthly', prio: '0.9' },
  { en: 'hurricane-kit', pt: 'pt/kit-de-emergencia-para-furacao', es: 'es/kit-de-emergencia-para-huracan', freq: 'monthly', prio: '0.8' },
  { en: 'business-hurricane-supply-list', pt: 'pt/kit-de-furacao-para-empresas', es: 'es/kit-de-huracan-para-empresas', freq: 'monthly', prio: '0.8' },
];

// ⚠️ Os valores de prio/freq abaixo vêm do sitemap que já estava no ar — são
// juízo editorial (os três guias de FASE valem mais que os de kit), não padrão.
// Ao gerar pela primeira vez eu os achatei em 0.8 sem querer. Não achatar.

// Páginas de um idioma só (sem grupo de tradução).
const AVULSAS = [
  { slug: 'privacy', freq: 'yearly', prio: '0.3' },
  { slug: 'press', freq: 'monthly', prio: '0.6' },
];

// ⚠️ `get/` fica FORA do sitemap DE PROPÓSITO: é um redirect para a App Store,
// não conteúdo. Listar redirect no sitemap é pedir pro Google rastrear algo que
// não tem o que indexar. NÃO adicione.
const IGNORAR = new Set(['get']);

const url = (slug) => BASE + '/' + (slug ? slug + '/' : '');
const arquivo = (slug) => path.join(RAIZ, slug, 'index.html');

// A data da última alteração real do arquivo — não a de hoje. Carimbar tudo com
// hoje a cada geração diz ao Google que 20 páginas mudaram quando nenhuma mudou,
// e ele aprende a ignorar o campo.
function lastmod(slug) {
  return fs.statSync(arquivo(slug)).mtime.toISOString().slice(0, 10);
}

function entrada(slug, alternates, freq, prio) {
  const alt = alternates
    ? Object.entries(alternates)
        .map(([l, s]) => `      <xhtml:link rel="alternate" hreflang="${l}" href="${url(s)}"/>`)
        .concat(`      <xhtml:link rel="alternate" hreflang="x-default" href="${url(alternates.en)}"/>`)
        .join('\n') + '\n'
    : '';
  return [
    '  <url>',
    `    <loc>${url(slug)}</loc>`,
    alt.trimEnd(),
    `    <lastmod>${lastmod(slug)}</lastmod>`,
    `    <changefreq>${freq}</changefreq>`,
    `    <priority>${prio}</priority>`,
    '  </url>',
  ]
    .filter(Boolean)
    .join('\n');
}

// ---------------------------------------------------------------------------
const faltando = [];
const entradas = [];

for (const g of GRUPOS) {
  const alt = { en: g.en, pt: g.pt, es: g.es };
  for (const l of ['en', 'pt', 'es']) {
    if (!fs.existsSync(arquivo(g[l]))) { faltando.push(g[l] || '(raiz)'); continue; }
    entradas.push(entrada(g[l], alt, g.freq, g.prio));
  }
}
for (const a of AVULSAS) {
  if (!fs.existsSync(arquivo(a.slug))) { faltando.push(a.slug); continue; }
  entradas.push(entrada(a.slug, null, a.freq, a.prio));
}

// Confere o contrário: existe página no disco que ficou de fora do mapa?
const noMapa = new Set([...GRUPOS.flatMap((g) => [g.en, g.pt, g.es]), ...AVULSAS.map((a) => a.slug)]);
const orfas = [];
(function varrer(dir, prefixo) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name.startsWith('.') || ['img', 'scripts', 'node_modules'].includes(e.name)) continue;
    const slug = prefixo ? prefixo + '/' + e.name : e.name;
    if (fs.existsSync(path.join(dir, e.name, 'index.html')) && !noMapa.has(slug) && !IGNORAR.has(slug)) orfas.push(slug);
    varrer(path.join(dir, e.name), slug);
  }
})(RAIZ, '');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Gerado por scripts/build_sitemap.js a partir dos arquivos existentes.
     NÃO editar à mão: rode \`node scripts/build_sitemap.js\` e commite o resultado.
     Cada página declara TODAS as alternativas de idioma, inclusive a si mesma:
     sem essa reciprocidade o Google descarta o grupo e as versões passam a
     competir entre si em vez de se reforçarem. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entradas.join('\n')}
</urlset>
`;

if (faltando.length) {
  console.error('ERRO — no mapa mas SEM arquivo no disco:\n  ' + faltando.join('\n  '));
  process.exit(1);
}
if (orfas.length) {
  console.error('ERRO — página no disco e FORA do mapa:\n  ' + orfas.join('\n  '));
  console.error('  (adicione ao GRUPOS/AVULSAS, ou a IGNORAR se for redirect)');
  process.exit(1);
}

const destino = path.join(RAIZ, 'sitemap.xml');
if (CHECK) {
  const atual = fs.existsSync(destino) ? fs.readFileSync(destino, 'utf8') : '';
  const igual = atual.replace(/\r\n/g, '\n') === xml;
  console.log(igual ? 'sitemap.xml está em dia' : 'sitemap.xml DESATUALIZADO — rode sem --check');
  process.exit(igual ? 0 : 1);
}

fs.writeFileSync(destino, xml, 'utf8');
console.log(`sitemap.xml gerado · ${entradas.length} URLs`);
