import { copyFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const outputDirectory = join(process.cwd(), 'dist', 'invitations', 'browser');

await Promise.all(
  ['web', 'mobile'].map(async (route) => {
    const routeDirectory = join(outputDirectory, route);
    await mkdir(routeDirectory, { recursive: true });
    await copyFile(join(outputDirectory, 'index.html'), join(routeDirectory, 'index.html'));
  })
);
