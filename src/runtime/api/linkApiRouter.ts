import { Context, Hono } from 'hono';
import ipRangeCheck from 'ip-range-check';

import { authenticationMiddleware } from '../authentication/authenticationMiddleware.ts';
import { LinkAPI } from './LinkAPI.ts';
import { ClientError } from './errors.ts';
import { ServerConsole } from '../server/ServerConsole.ts';
import { resultOk } from './api.ts';
import { resultError } from './api.ts';
import { Bindings } from '../server/TempLinkSrv.ts';
import { CONFIG } from '../../setup/index.ts';
import { ZodError } from 'zod';
import { zLinkRequest } from './LinkAPI.ts';

export const linkApiRouter = new Hono<{ Bindings: Bindings }>();

function getClientIp(c: Context<{ Bindings: Bindings }>) {
    if (CONFIG.useXForwardedFor) {
        return c.req.header('X-Forwarded-For');
    } else {
        return c.env.info.remoteAddr.hostname;
    }
}

linkApiRouter.use('*', async (c, next) => {
    const clientIp = getClientIp(c);
    console.log(clientIp);
    if (clientIp == null || !ipRangeCheck(clientIp, CONFIG.apiAccessIpWhitelist)) {
        c.status(403);
        return c.body(null);
    }
    await next();
});

linkApiRouter.use('*', authenticationMiddleware);
linkApiRouter.use('*', async (c, next) => {
    c.header('Content-Type', 'application/json');
    await next();
});

linkApiRouter.post(
    '/',
    async (c) => {
        const request = zLinkRequest.parse(await c.req.json());
        const result = await LinkAPI.instance.create(request);
        const response = resultOk(result);
        c.status(201);
        c.header('Content-Location', `/api/links/${result.id}`);
        return c.body(JSON.stringify(response));
    },
);

linkApiRouter.get(
    '/:linkId',
    async (c) => {
        const result = await LinkAPI.instance.get(c.req.param('linkId'));
        const response = resultOk(result);
        c.status(200);
        return c.body(JSON.stringify(response));
    },
);

linkApiRouter.delete(
    '/:linkId',
    async (c) => {
        await LinkAPI.instance.delete(c.req.param('linkId'));
        const response = resultOk(null);
        c.status(200);
        return c.body(JSON.stringify(response));
    },
);

linkApiRouter.onError((e, c) => {
    if (e instanceof ClientError) {
        c.status(e.status);
        const response = resultError({
            type: 'error',
            description: e.clientMessage,
        });
        return c.body(JSON.stringify(response));
    } else if (e instanceof ZodError) {
        c.status(400);
        const response = resultError({
            type: 'error',
            description: e.message,
            issues: e.issues,
        });
        return c.body(JSON.stringify(response));
    } else {
        ServerConsole.instance.error(e);
        const response = resultError({
            type: 'error',
            description: 'Internal server error',
        });
        c.status(500);
        return c.body(JSON.stringify(response));
    }
});
