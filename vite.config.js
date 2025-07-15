import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { execSync } from 'child_process';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app-modular.js'],
            refresh: true,
        }),
        tailwindcss(),
        {
            name: 'copy-to-root',
            closeBundle: () => {
                console.log('Copying built assets to root directory...');
                try {
                    execSync('cp public/build/assets/app-*.js ../script.js');
                    execSync('cp public/build/assets/app-*.css ../styles.css');
                    console.log('Finished copying and renaming assets.');
                } catch (error) {
                    console.error('Error copying assets:', error);
                }
            },
        },
    ],
});
