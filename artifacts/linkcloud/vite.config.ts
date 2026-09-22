import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

function adminApiPlugin(): Plugin {
  return {
    name: 'admin-api-plugin',
    apply: 'serve',
    async configureServer(server) {
      const {
        handleAdminUserStatusRequest,
        handleAdminUserDeleteRequest,
        handleAdminStatsRequest,
        handleAdminMigrationDryRunRequest,
        handleAdminCleanupUnverifiedRequest,
      } = await server.ssrLoadModule('/src/server/admin-api.ts');
      const {
        handleDevEmailChangeRequest,
        handleDevEmailChangeResend,
        handleDevEmailChangeVerify,
        handleDevEmailChangeSessionRefresh,
        handleDevEmailChangeCancel,
      } = await server.ssrLoadModule('/src/server/dev-email-change.ts');
      const {
        handleAuthProvisionUser,
        handleAuthProvisionGoogleUser,
        handleAuthProvisionPhoneUser,
        handleAuthCheckRegistration,
      } = await server.ssrLoadModule('/src/server/auth-api.ts');

      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0];
        if (url === '/api/admin/users/status') {
          return handleAdminUserStatusRequest(req, res);
        }
        if (url === '/api/admin/users/delete') {
          return handleAdminUserDeleteRequest(req, res);
        }
        if (url === '/api/admin/stats') {
          return handleAdminStatsRequest(req, res);
        }
        if (url === '/api/admin/migration/dry-run') {
          return handleAdminMigrationDryRunRequest(req, res);
        }
        if (url === '/api/admin/cleanup-unverified') {
          return handleAdminCleanupUnverifiedRequest(req, res);
        }
        if (url === '/api/auth/check-registration') {
          return handleAuthCheckRegistration(req, res);
        }
        if (url === '/api/auth/provision-user') {
          return handleAuthProvisionUser(req, res);
        }
        if (url === '/api/auth/provision-google-user') {
          return handleAuthProvisionGoogleUser(req, res);
        }
        if (url === '/api/auth/provision-phone-user') {
          return handleAuthProvisionPhoneUser(req, res);
        }
        if (url === '/api/email-change/request') {
          return handleDevEmailChangeRequest(req, res);
        }
        if (url === '/api/email-change/resend') {
          return handleDevEmailChangeResend(req, res);
        }
        if (url === '/api/email-change/verify') {
          return handleDevEmailChangeVerify(req, res);
        }
        if (url === '/api/email-change/session-refresh') {
          return handleDevEmailChangeSessionRefresh(req, res);
        }
        if (url === '/api/email-change/cancel') {
          return handleDevEmailChangeCancel(req, res);
        }
        next();
      });
    },
  };
}

const port = 3000;
const basePath = process.env.BASE_PATH || '/';

export default defineConfig(async ({ command }) => ({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    ...(command === 'build' ? [] : [adminApiPlugin()]),
    ...(process.env.NODE_ENV !== 'production'
      ? [runtimeErrorOverlay()]
      : []),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('firebase')) {
              return 'firebase-sdk';
            }
            if (id.includes('recharts') || id.includes('d3-')) {
              return 'vendor-recharts';
            }
            if (id.includes('framer-motion')) {
              return 'vendor-framer';
            }
            if (id.includes('lucide-react') || id.includes('react-icons')) {
              return 'vendor-icons';
            }
            if (id.includes('@radix-ui') || id.includes('vaul') || id.includes('cmdk') || id.includes('embla-carousel')) {
              return 'vendor-ui';
            }
            if (id.includes('@tanstack') || id.includes('wouter') || id.includes('next-themes') || id.includes('sonner')) {
              return 'vendor-core';
            }
            if (id.includes('react/') || id.includes('react-dom/') || id.includes('scheduler')) {
              return 'vendor-react';
            }
          }

          if (id.includes('/src/lib/cloudinary')) {
            return 'cloudinary';
          }
          if (id.includes('/src/lib/india-data')) {
            return 'india-data';
          }
        },
      },
    },
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
}));
