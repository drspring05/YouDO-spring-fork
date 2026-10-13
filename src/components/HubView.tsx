import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import BoardView from './BoardView';
import type { PaceRow, PaceWindow } from '../lib/paceBoard';
import UserProfileSheet from './UserProfileSheet';
import HubAuthGate from './HubAuthGate';
import PrivateHubUnderDevelopment from './PrivateHubUnderDevelopment';
import PrivateHubView from './PrivateHubView';

export default function HubView({
  onOpenBoardSettings,
  activeTab = 'social',
  privateHubOpen = false,
  personalPace,
  onSwitchToPrivate,
  onSwitchToPublic,
  pendingCount,
  refreshPendingCount,
  refreshDmInbox,
  refreshSquadChat,
  dmsTabAttention,
  roomsTabAttention,
}: {
  onOpenBoardSettings: () => void;
  activeTab?: 'social' | 'private';
  /** From the Admin Hub switch: members see the hub only once it is on; admins always do. */
  privateHubOpen?: boolean;
  personalPace?: number;
  onSwitchToPrivate?: () => void;
  onSwitchToPublic?: () => void;
  pendingCount?: number;
  refreshPendingCount?: () => void;
  refreshDmInbox?: () => void;
  refreshSquadChat?: () => void;
  dmsTabAttention?: boolean;
  roomsTabAttention?: boolean;
}) {
  const { user } = useAuth();
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [profileBoardPreview, setProfileBoardPreview] = useState<PaceRow | null>(null);
  const [profileBoardWindow, setProfileBoardWindow] = useState<PaceWindow>('week');
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!user) {
    return (
      <div className="w-full">
        <div key={activeTab} className="hub-screen-transition overflow-x-hidden">
          {activeTab === 'social' ? (
            <HubAuthGate
              tab={activeTab}
              isOffline={!isOnline}
              onSwitchTab={(target) => {
                if (target === 'private') onSwitchToPrivate?.();
                else onSwitchToPublic?.();
              }}
            />
          ) : (
            <PrivateHubUnderDevelopment onSwitchToPublic={onSwitchToPublic} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div key={activeTab} className="hub-screen-transition overflow-x-hidden">
        {activeTab === 'social' ? (
          <BoardView
            onOpenBoardSettings={onOpenBoardSettings}
            onOpenProfile={(id, row, paceWindow) => {
              setProfileUserId(id);
              setProfileBoardPreview(row ?? null);
              if (paceWindow) setProfileBoardWindow(paceWindow);
            }}
          />
        ) : privateHubOpen ? (
          <PrivateHubView
            personalPace={personalPace}
            onSwitchToPublic={onSwitchToPublic}
            pendingCount={pendingCount}
            refreshPendingCount={refreshPendingCount}
            refreshDmInbox={refreshDmInbox}
            refreshSquadChat={refreshSquadChat}
            dmsTabAttention={dmsTabAttention}
            roomsTabAttention={roomsTabAttention}
          />
        ) : (
          <PrivateHubUnderDevelopment onSwitchToPublic={onSwitchToPublic} />
        )}
      </div>

      <UserProfileSheet
        userId={profileUserId}
        boardPreview={profileBoardPreview}
        boardPaceWindow={profileBoardWindow}
        onClose={() => {
          setProfileUserId(null);
          setProfileBoardPreview(null);
        }}
        onMessage={() => {
          setProfileUserId(null);
          onSwitchToPrivate?.();
        }}
      />
    </div>
  );
}
