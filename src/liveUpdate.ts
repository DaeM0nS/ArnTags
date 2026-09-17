import { LiveUpdate } from '@capawesome/capacitor-live-update';
import { Preferences } from '@capacitor/preferences';
import { Dialog } from '@capacitor/dialog';

const UPDATE_CHANNEL_KEY = 'update_channel';
const UPDATE_CHANNELS_CACHE_KEY = 'update_channels_cache';
const DEFAULT_CHANNEL = import.meta.env.VITE_BRANCH_NAME ?? 'default';
const LAST_PROMPTED_BUNDLE_KEY = 'liveupdate_last_prompted_bundle';

// URL de base pour les manifests self-hosted
// Remplace par ton propre endpoint, par exemple :
// - https://ton-projet.supabase.co/storage/v1/object/public/live-updates/manifests
// - https://ton-domaine.com/updates/manifests
const MANIFEST_BASE_URL = 'https://supabase.pixelmon-france.fr/storage/v1/object/public/live-updates-arntags/manifests';

let debugListener: ((text: string) => void) | null = null;
let liveUpdateSetupStarted = false;

function pushDebug(text: string) {
    debugListener?.(text);
}

export function setLiveUpdateDebugListener(listener: ((text: string) => void) | null) {
    debugListener = listener;
}

export function getDefaultUpdateChannel() {
    return DEFAULT_CHANNEL;
}

export async function saveUpdateChannel(channel: string) {
    const normalized = (channel || '').trim() || DEFAULT_CHANNEL;
    await Preferences.set({ key: UPDATE_CHANNEL_KEY, value: normalized });
}

export async function getSavedUpdateChannel() {
    const { value } = await Preferences.get({ key: UPDATE_CHANNEL_KEY });
    return value ? value?.trim() : DEFAULT_CHANNEL;
}

export async function getCurrentUpdateChannel() {
    try {
        const result = await LiveUpdate.getChannel();
        return result.channel?.trim() || (await getSavedUpdateChannel());
    } catch {
        return await getSavedUpdateChannel();
    }
}

export async function cacheAvailableChannels(channels: string[]) {
    await Preferences.set({
        key: UPDATE_CHANNELS_CACHE_KEY,
        value: JSON.stringify(channels),
    });
}

export async function getCachedAvailableChannels(): Promise<string[]> {
    const { value } = await Preferences.get({
        key: UPDATE_CHANNELS_CACHE_KEY,
    });

    if (!value) {
        return [DEFAULT_CHANNEL];
    }

    try {
        const parsed = JSON.parse(value);

        if (Array.isArray(parsed)) {
            const cleaned = parsed.map(v => String(v).trim()).filter(Boolean);
            return cleaned.length ? cleaned : [DEFAULT_CHANNEL];
        }
    } catch {
        // ignore
    }

    return [DEFAULT_CHANNEL];
}

type SelfHostedChannelsManifest = {
    channels: string[];
};

export async function fetchAvailableChannels(): Promise<string[]> {
    try {
        const response = await fetch(`${MANIFEST_BASE_URL}/channels.json`, {
            cache: 'no-store',
        });

        if (!response.ok) {
            throw new Error(`Channels indisponibles: HTTP ${response.status}`);
        }

        const payload = (await response.json()) as SelfHostedChannelsManifest;

        const channels = Array.from(
            new Set(
                (payload.channels || [])
                    .map(channel => String(channel).trim())
                    .filter(Boolean)
            )
        );

        const result = channels.length ? channels : [DEFAULT_CHANNEL];

        await cacheAvailableChannels(result);
        return result;
    } catch (error) {
        pushDebug(`Impossible de récupérer channels.json: ${String(error)}`);
        return await getCachedAvailableChannels();
    }
}

export async function getCurrentBundle() {
    const currentBundle = await LiveUpdate.getCurrentBundle().catch(() => ({
        bundleId: null,
    }));
    return currentBundle;
}

export async function getSelfHostedUpdateStatus(channel?: string) {
    const selectedChannel = (channel || (await getSavedUpdateChannel())) ? (channel || (await getSavedUpdateChannel())).trim() : DEFAULT_CHANNEL;

    const manifest = await fetchSelfHostedManifest(selectedChannel);
    const currentBundle = await LiveUpdate.getCurrentBundle().catch(() => ({
        bundleId: null,
    }));

    const nextBundle = await LiveUpdate.getNextBundle().catch(() => ({
        bundleId: null,
    }));

    const bundleExistsLocallyFlag = manifest?.bundleId
        ? await bundleExistsLocally(manifest.bundleId)
        : false;

    return {
        channel: selectedChannel,
        manifest,
        latestBundleId: manifest?.bundleId ?? null,
        currentBundleId: currentBundle.bundleId ?? null,
        nextBundleId: nextBundle.bundleId ?? null,
        bundleExistsLocally: bundleExistsLocallyFlag,
        updateAvailable:
            Boolean(manifest?.bundleId) &&
            manifest?.bundleId !== currentBundle.bundleId,
        updateDownloaded:
            Boolean(manifest?.bundleId) &&
            manifest?.bundleId === nextBundle.bundleId,
    };
}

export async function switchToChannelAndApplyLatest(channel: string) {
    const normalized = (channel || '').trim() || DEFAULT_CHANNEL;

    // Sauvegarde le channel
    await saveUpdateChannel(normalized);
    await LiveUpdate.setChannel({ channel: normalized });

    const manifest = await fetchSelfHostedManifest(normalized);

    if (!manifest) {
        throw new Error(`Aucun manifest trouvé pour le channel "${normalized}".`);
    }

    const current = await LiveUpdate.getCurrentBundle();

    // Déjà sur la bonne version
    if (current.bundleId === manifest.bundleId) {
        return {
            action: 'already_on_latest',
            bundleId: manifest.bundleId,
        };
    }

    const exists = await bundleExistsLocally(manifest.bundleId);

    // Cas A : bundle pas en local → nouvelle version à télécharger
    if (!exists) {
        await LiveUpdate.downloadBundle({
            bundleId: manifest.bundleId,
            url: manifest.url,
            checksum: manifest.checksum,
            signature: manifest.signature,
        });

        await LiveUpdate.setNextBundle({
            bundleId: manifest.bundleId,
        });

        return {
            action: 'new_update_downloaded',
            bundleId: manifest.bundleId,
            downloaded: true,
        };
    }

    // Cas B : bundle déjà en local → pas de nouvelle version, on applique direct
    await LiveUpdate.setNextBundle({
        bundleId: manifest.bundleId,
    });

    return {
        action: 'apply_existing_bundle',
        bundleId: manifest.bundleId,
    };
}

export async function setLiveUpdateChannel(channel: string) {
    const normalized = (channel || '').trim() || DEFAULT_CHANNEL;

    // Change le channel natif
    await LiveUpdate.setChannel({ channel: normalized });

    // Sauvegarde le channel
    await saveUpdateChannel(normalized);

    // Reset du next bundle pour éviter les états incohérents
    await LiveUpdate.reset();

}

export async function getLiveUpdateDebugSnapshot() {
    const savedChannel = await getSavedUpdateChannel();
    const nativeChannel = await getCurrentUpdateChannel();
    const currentBundle = await LiveUpdate.getCurrentBundle().catch(() => ({ bundleId: null }));
    const nextBundle = await LiveUpdate.getNextBundle().catch(() => ({ bundleId: null }));
    const manifest = await fetchSelfHostedManifest(savedChannel).catch(() => null);
    const bundles = await LiveUpdate.getBundles().catch(() => ({ bundleIds: [] }));
    const versionName = await LiveUpdate.getVersionName().catch(() => ({ versionName: null }));
    const versionCode = await LiveUpdate.getVersionCode().catch(() => ({ versionCode: null }));
    const deviceId = await LiveUpdate.getDeviceId().catch(() => ({ deviceId: null }));

    return {
        savedChannel,
        nativeChannel,
        currentBundleId: currentBundle.bundleId ?? null,
        nextBundleId: nextBundle.bundleId ?? null,
        latestBundleId: manifest?.bundleId ?? null,
        manifestUrl: `${MANIFEST_BASE_URL}/${encodeURIComponent(savedChannel)}.json`,
        manifest: manifest ?? null,
        bundleIds: bundles.bundleIds ?? [],
        versionName: versionName.versionName ?? null,
        versionCode: versionCode.versionCode ?? null,
        deviceId: deviceId.deviceId ?? null,
    };
}

async function getLastPromptedBundleId() {
    const { value } = await Preferences.get({ key: LAST_PROMPTED_BUNDLE_KEY });
    return value ?? null;
}

async function setLastPromptedBundleId(bundleId: string | null) {
    if (!bundleId) {
        await Preferences.remove({ key: LAST_PROMPTED_BUNDLE_KEY });
        return;
    }

    await Preferences.set({
        key: LAST_PROMPTED_BUNDLE_KEY,
        value: bundleId,
    });
}

// --- Types pour le manifest self-hosted ---

export type SelfHostedUpdateManifest = {
    channel: string;
    bundleId: string;
    versionName?: string;
    versionCode?: number;
    url: string;
    checksum?: string;
    signature?: string;
};

// --- Fonctions self-hosted ---

export async function fetchSelfHostedManifest(
    channel: string
): Promise<SelfHostedUpdateManifest | null> {
    const normalizedChannel = channel.trim();

    const response = await fetch(
        `${MANIFEST_BASE_URL}/${encodeURIComponent(normalizedChannel)}.json`,
        {
            cache: 'no-store',
        }
    );

    if (response.status === 404) {
        return null;
    }

    if (!response.ok) {
        throw new Error(`Manifest indisponible: HTTP ${response.status}`);
    }

    return (await response.json()) as SelfHostedUpdateManifest;
}

export async function downloadSelfHostedUpdate(
    manifest: SelfHostedUpdateManifest
) {
    if (!manifest.bundleId) {
        throw new Error('Le manifest ne contient pas de bundleId.');
    }

    if (!manifest.url) {
        throw new Error('Le manifest ne contient pas de URL.');
    }

    const current = await LiveUpdate.getCurrentBundle();

    // Déjà sur ce bundle
    if (current.bundleId === manifest.bundleId) {
        return {
            available: false,
            bundleId: manifest.bundleId,
            alreadyCurrent: true,
        };
    }

    const exists = await bundleExistsLocally(manifest.bundleId);

    if (!exists) {
        // Bundle pas encore en local → on le télécharge
        await LiveUpdate.downloadBundle({
            bundleId: manifest.bundleId,
            url: manifest.url,
            checksum: manifest.checksum,
            signature: manifest.signature,
        });
    }

    // Dans tous les cas, on le définit comme next bundle
    await LiveUpdate.setNextBundle({
        bundleId: manifest.bundleId,
    });

    return {
        available: true,
        bundleId: manifest.bundleId,
        downloaded: !exists,
        alreadyCurrent: false,
    };
}

export async function checkSelfHostedUpdate(channel: string) {
    const manifest = await fetchSelfHostedManifest(channel);

    if (!manifest) {
        return {
            available: false,
            manifest: null,
        };
    }

    const result = await downloadSelfHostedUpdate(manifest);

    return {
        ...result,
        manifest,
    };
}

// --- Popup et application ---

async function promptAndApplyUpdate(nextBundleId: string) {
    pushDebug(`Nouvelle update téléchargée (${nextBundleId}).`);

    const result = await Dialog.confirm({
        title: 'Mise à jour disponible',
        message: `Une nouvelle version a été téléchargée (${nextBundleId}). Voulez-vous l’appliquer maintenant ?`,
        okButtonTitle: 'OK',
        cancelButtonTitle: 'Plus tard',
    });

    if (!result.value) {
        pushDebug('L’utilisateur a choisi de ne pas appliquer l’update maintenant.');
        return;
    }

    pushDebug(`Application de l’update ${nextBundleId}...`);
    await LiveUpdate.reload();
}

export async function askAndApplySelfHostedUpdate(
    bundleId: string
): Promise<boolean> {
    const result = await Dialog.confirm({
        title: 'Mise à jour disponible',
        message: `Une nouvelle version (${bundleId}) est prête. Voulez-vous redémarrer l’application maintenant ?`,
        okButtonTitle: 'Redémarrer',
        cancelButtonTitle: 'Plus tard',
    });

    if (!result.value) {
        return false;
    }

    pushDebug(`[APPLY] Avant reload() - bundle: ${bundleId}`);

    try {
        await LiveUpdate.reload();
        pushDebug(`[APPLY] reload() appelé avec succès`);
    } catch (error) {
        pushDebug(`[APPLY] Erreur reload(): ${String(error)}`);
        throw error;
    }

    return true;
}

// --- Setup principal (mode self-hosted) ---

export async function setupLiveUpdates() {
    if (liveUpdateSetupStarted) {
        pushDebug('setupLiveUpdates already started, skip.');
        return;
    }

    liveUpdateSetupStarted = true;

    try {
        pushDebug('ready...');
        const readyResult = await LiveUpdate.ready();

        const savedChannel = await getSavedUpdateChannel();
        const channelToUse = savedChannel || DEFAULT_CHANNEL;

        pushDebug(
            JSON.stringify(
                {
                    step: 'after-ready',
                    rollback: readyResult.rollback,
                    currentBundleId: readyResult.currentBundleId ?? null,
                    previousBundleId: readyResult.previousBundleId ?? null,
                    channelToUse,
                },
                null,
                2
            )
        );

        // Récupère le manifest self-hosted pour le channel
        pushDebug(`Récupération du manifest pour le channel ${channelToUse}...`);

        const manifest = await fetchSelfHostedManifest(channelToUse);

        if (!manifest) {
            pushDebug(`Aucun manifest trouvé pour le channel ${channelToUse}.`);
            pushDebug('Aucune update à appliquer.');
            return;
        }

        pushDebug(
            JSON.stringify(
                {
                    step: 'manifest',
                    channel: manifest.channel,
                    bundleId: manifest.bundleId,
                    url: manifest.url,
                },
                null,
                2
            )
        );

        const currentBundle = await LiveUpdate.getCurrentBundle();

        if (currentBundle.bundleId === manifest.bundleId) {
            pushDebug('Le bundle courant est déjà à jour.');
            await setLastPromptedBundleId(null);
            pushDebug('Aucune update à appliquer.');
            return;
        }

        const lastPromptedBundleId = await getLastPromptedBundleId();

        if (lastPromptedBundleId === manifest.bundleId) {
            pushDebug(`Update ${manifest.bundleId} déjà proposée, popup ignorée.`);
            return;
        }

        pushDebug(`Téléchargement du bundle ${manifest.bundleId}...`);

        await downloadSelfHostedUpdate(manifest);

        pushDebug(`Bundle ${manifest.bundleId} prêt à être appliqué.`);

        await setLastPromptedBundleId(manifest.bundleId);
        await promptAndApplyUpdate(manifest.bundleId);

        if (readyResult.currentBundleId) {
            await setLastPromptedBundleId(null);
        }
    } catch (error) {
        pushDebug(`Erreur live update: ${String(error)}`);
    }
}

export async function bundleExistsLocally(bundleId: string) {
    const result = await LiveUpdate.getDownloadedBundles().catch(() => ({
        bundleIds: [],
    }));

    const ids: string[] = Array.isArray(result.bundleIds)
        ? (result.bundleIds as string[])
        : [];

    return ids.includes(bundleId);
}