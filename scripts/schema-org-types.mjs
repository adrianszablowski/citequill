import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const version = '30.1';

const release = `https://schema.org/version/${version}/schemaorg-current-https.jsonld`;

const target = fileURLToPath(
    new URL('../features/audit/schema-org.ts', import.meta.url),
);

const [source] = process.argv.slice(2);
const graph = JSON.parse(await releaseText(source))['@graph'];

const types = graph
    .filter(
        (node) =>
            [node['@type']].flat().includes('rdfs:Class') &&
            isSchemaOrg(node['@id']),
    )
    .map((node) => [
        nameOf(node['@id']),
        [node['rdfs:subClassOf'] ?? []]
            .flat()
            .map(({ '@id': id }) => id)
            .filter(isSchemaOrg)
            .map(nameOf),
    ])
    .sort(([one], [other]) => (one < other ? -1 : 1));

await writeFile(
    target,
    `export const schemaOrgVersion = '${version}';\n\nexport type SchemaOrgType = keyof typeof schemaOrgTypes;\n\nexport const schemaOrgTypes = ${JSON.stringify(Object.fromEntries(types))};\n`,
);

// Prettier runs here and not after `&&` in package.json, because pnpm appends
// a script's arguments to its last command and prettier would get the file.
execFileSync(
    process.execPath,
    [
        fileURLToPath(import.meta.resolve('prettier/bin/prettier.cjs')),
        '--write',
        target,
    ],
    { stdio: 'inherit' },
);

async function releaseText(path) {
    if (path) {
        return readFile(path, 'utf8');
    }

    const response = await fetch(release);

    if (!response.ok) {
        throw new Error(`${release} answered ${response.status}`);
    }

    return response.text();
}

function isSchemaOrg(id) {
    return id.startsWith('schema:');
}

function nameOf(id) {
    return id.replace(/^schema:/, '');
}
