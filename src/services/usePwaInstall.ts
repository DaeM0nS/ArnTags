import { useEffect, useState } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
}

function isStandaloneMode(): boolean {
  const displayModeStandalone = window.matchMedia(
    '(display-mode: standalone)',
  ).matches;

  const iosStandalone = (
    window.navigator as Navigator & {
      standalone?: boolean;
    }
  ).standalone === true;

  return displayModeStandalone || iosStandalone;
}

function detectIos(): boolean {
  return /iphone|ipad|ipod/i.test(
    window.navigator.userAgent,
  );
}

function detectSafari(): boolean {
  const userAgent = window.navigator.userAgent;

  return (
    /safari/i.test(userAgent) &&
    !/crios|fxios|edgios|opios|android/i.test(userAgent)
  );
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  const [isInstalled, setIsInstalled] =
    useState(false);

  const [isIos, setIsIos] =
    useState(false);

  const [isSafari, setIsSafari] =
    useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    setIsInstalled(isStandaloneMode());
    setIsIos(detectIos());
    setIsSafari(detectSafari());

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();

      console.log('✅ beforeinstallprompt reçu');

      setDeferredPrompt(
        event as BeforeInstallPromptEvent,
      );
    };

    const handleAppInstalled = () => {
      console.log('✅ Application installée');

      setDeferredPrompt(null);
      setIsInstalled(true);
    };

    window.addEventListener(
      'beforeinstallprompt',
      handleBeforeInstallPrompt,
    );

    window.addEventListener(
      'appinstalled',
      handleAppInstalled,
    );

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt,
      );

      window.removeEventListener(
        'appinstalled',
        handleAppInstalled,
      );
    };
  }, []);

  const install = async (): Promise<boolean> => {
    if (!deferredPrompt) {
      return false;
    }

    await deferredPrompt.prompt();

    const choice =
      await deferredPrompt.userChoice;

    setDeferredPrompt(null);

    if (choice.outcome === 'accepted') {
      setIsInstalled(true);
      return true;
    }

    return false;
  };

  const canShowIosInstructions =
    isIos &&
    isSafari &&
    !isInstalled;

  return {
    canInstall:
      deferredPrompt !== null &&
      !isInstalled,

    canShowIosInstructions,

    isInstalled,

    isIos,

    isSafari,

    install,
  };
}