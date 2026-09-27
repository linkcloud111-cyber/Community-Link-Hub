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
        handleAdminSettingsGetRequest,
        handleAdminSettingsUpdateRequest,
        handleAnnouncementsGetRequest,
        handleAdminAnnouncementsListRequest,
        handleAdminAnnouncementCreateRequest,
        handleAdminAnnouncementUpdateRequest,
        handleAdminAnnouncementDeleteRequest,
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
        if (url === '/api/announcements') {
          return handleAnnouncementsGetRequest(req, res);
        }
        if (url === '/api/admin/announcements') {
          if (req.method === 'GET') {
            return handleAdminAnnouncementsListRequest(req, res);
          }
          if (req.method === 'POST') {
            return handleAdminAnnouncementCreateRequest(req, res);
          }
          if (req.method === 'PUT' || req.method === 'PATCH') {
            return handleAdminAnnouncementUpdateRequest(req, res);
          }
          if (req.method === 'DELETE') {
            return handleAdminAnnouncementDeleteRequest(req, res);
          }
        }
        if (url === '/api/admin/settings') {
          if (req.method === 'GET') {
            return handleAdminSettingsGetRequest(req, res);
          }
          return handleAdminSettingsUpdateRequest(req, res);
        }
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
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return;
          }
          // React core runtime
          if (id.includes('react/') || id.includes('react-dom/') || id.includes('scheduler')) {
            return 'vendor-react';
          }
          // Firebase partitioned to isolate firestore/webchannel from auth/core
          if (id.includes('@firebase/firestore') || id.includes('firebase/firestore') || id.includes('webchannel-wrapper')) {
            return 'vendor-firebase-firestore';
          }
          if (id.includes('@firebase/auth') || id.includes('firebase/auth')) {
            return 'vendor-firebase-auth';
          }
          if (id.includes('firebase')) {
            return 'vendor-firebase-core';
          }
          // Recharts and all its sub-dependencies (d3, victory-vendor, recharts-scale)
          if (id.includes('recharts') || id.includes('d3-') || id.includes('victory-vendor') || id.includes('recharts-scale')) {
            return 'vendor-recharts';
          }
          // Framer Motion and all motion primitives (motion-dom, motion-utils)
          if (id.includes('framer-motion') || id.includes('motion-dom') || id.includes('motion-utils')) {
            return 'vendor-framer';
          }
          // Icon libraries
          if (id.includes('lucide-react') || id.includes('react-icons')) {
            return 'vendor-icons';
          }
          // Radix and dialog/input UI primitives
          if (id.includes('@radix-ui') || id.includes('vaul') || id.includes('cmdk') || id.includes('embla-carousel') || id.includes('input-otp')) {
            return 'vendor-ui';
          }
          // Form handling & validation schemas
          if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('zod')) {
            return 'vendor-forms';
          }
          // Core utilities (query client, routing, theme, styling, notifications)
          if (id.includes('@tanstack') || id.includes('wouter') || id.includes('next-themes') || id.includes('sonner') || id.includes('clsx') || id.includes('tailwind-merge') || id.includes('class-variance-authority')) {
            return 'vendor-core';
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
