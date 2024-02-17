// @deno-types="npm:@types/express@4.17.21"
import express from 'npm:express@4.18.2';
import { fromFileUrl } from 'https://deno.land/std@0.215.0/path/mod.ts';

import { CONFIG } from '../../setup/index.ts';
import { ServerConsole } from './ServerConsole.ts';
import { Registry } from './Registry.ts';

export class TempLinkSrv {
    public static readonly instance = new TempLinkSrv();

    private readonly app = express();

    private readonly server;

    private readonly rootHtmlPath = fromFileUrl(new URL('../../resources/html/index.html', import.meta.url));

    private readonly notFoundHtmlPath = fromFileUrl(new URL('../../resources/html/404.html', import.meta.url));

    private closed = false;

    private constructor() {
        ServerConsole.instance.enable();
        this.app.get('/', (_req, res) => {
            res.sendFile(this.rootHtmlPath);
        });
        this.app.get('/:linkId', async (req, res) => {
            const id = req.params.linkId;
            const linkRecord = await Registry.instance.getLinkById(id);
            if (linkRecord == null) {
                return res.status(404).sendFile(this.notFoundHtmlPath);
            }
            return res.redirect(301, linkRecord.destination.toString());
        });
        this.server = this.app.listen(CONFIG.linkPort, CONFIG.linkHostname);
    }

    public close() {
        return Promise.all([
            Registry.instance.close(),
            ServerConsole.instance.close(),
            new Promise<void>((resolve, reject) => {
                this.server.close((err: unknown) => {
                    if (err == null) {
                        this.closed = true;
                        resolve();
                    } else {
                        reject(err);
                    }
                });
            }),
        ]);
    }

    public get isClosed() {
        return this.closed;
    }
}

export const tempLinkSrv = TempLinkSrv.instance;
