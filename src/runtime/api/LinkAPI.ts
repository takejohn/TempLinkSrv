import { Registry } from '../server/Registry.ts';
import { ClientError } from './errors.ts';
import { CONFIG } from '../../setup/index.ts';
import { LinkRecord } from '../database/LinkRecord.ts';
import { zResponseValue } from './api.ts';
import { z } from 'zod';

export const zLinkRequest = z.object({
    destination: z.string(),
    expirationTime: z.number(),
});

export type LinkRequest = z.infer<typeof zLinkRequest>;

const zLinkResource = zResponseValue.extend({
    type: z.literal('link_resource'),
    link: z.string(),
    id: z.string(),
    destination: z.string(),
    expiration_time: z.number(),
    creation_date: z.number(),
    expiration_date: z.number(),
});

export type LinkResource = z.infer<typeof zLinkResource>;

export class LinkAPI {
    public static readonly instance = new LinkAPI();

    public async create(linkRequest: LinkRequest): Promise<LinkResource> {
        const destination = stringToURL(linkRequest.destination);
        const result = await Registry.instance.createLink(destination, linkRequest.expirationTime);
        if (result == null) {
            throw new Error('Failed to create a link');
        }
        return toResource(result.id, result.record);
    }

    public async get(id: string): Promise<LinkResource | null> {
        const result = await Registry.instance.getLinkById(id);
        if (result == null) {
            return null;
        }
        return toResource(id, result);
    }

    public async delete(id: string): Promise<void> {
        const result = await Registry.instance.deleteLink(id);
        if (!result) {
            throw new ClientError(`Link '${id}' was not found`);
        }
    }
}

function stringToURL(s: string) {
    if (!s.startsWith('http://') && !s.startsWith('https://')) {
        throw new ClientError(`The destination must start with 'http://' or 'https://'; destination: ${s}`);
    }
    try {
        return new URL(s);
    } catch (_) {
        throw new ClientError(`Invalid URL: '${s}'`);
    }
}

function toResource(id: string, record: LinkRecord): LinkResource {
    return {
        type: 'link_resource',
        link: `https://${CONFIG.linkDomain}/${id}`,
        id,
        destination: record.destination.toString(),
        expiration_time: record.expirationTime,
        creation_date: record.creationDate,
        expiration_date: record.expirationDate,
    };
}
