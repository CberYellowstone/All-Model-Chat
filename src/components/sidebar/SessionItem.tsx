import React, { useRef, useState, type RefObject } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { Pin, MoreHorizontal } from 'lucide-react';
import { type ChatGroup, type SavedChatSession } from '@/types';
import { SessionItemMenu } from './SessionItemMenu';
import { LoadingDots } from '@/components/shared/LoadingDots';
import { useChatStore } from '@/stores/chatStore';
import { SESSION_DRAG_TYPE } from './sidebarDragTypes';

interface SessionItemProps {
  session: SavedChatSession;
  activeSessionId: string | null;
  editingItem: { type: 'session' | 'group'; id: string; title: string } | null;
  activeMenu: string | null;
  loadingSessionIds: Set<string>;
  generatingTitleSessionIds: Set<string>;
  newlyTitledSessionIds: ReadonlySet<string>;
  groups: ChatGroup[];
  editInputRef: RefObject<HTMLInputElement>;
  menuRef: RefObject<HTMLDivElement>;
  onSelectSession: (sessionId: string) => void;
  onTogglePinSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onDuplicateSession: (sessionId: string) => void;
  onOpenExportModal: (sessionId?: string) => void | Promise<void>;
  onMoveSessionToGroup: (sessionId: string, groupId: string | null) => void;
  handleStartEdit: (item: SavedChatSession) => void;
  handleRenameConfirm: () => void;
  handleRenameKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  setEditingItem: (item: { type: 'session' | 'group'; id: string; title: string } | null) => void;
  toggleMenu: (e: React.MouseEvent, id: string) => void;
  setActiveMenu: (id: string | null) => void;
  setDragOverId: (id: string | null) => void;
  draggingSessionId: string | null;
  onSessionDragStart: (sessionId: string) => void;
  onSessionDragEnd: () => void;
}

const RIGHT_CLICK_MENU_FEEDBACK_MS = 200;

export const SessionItem: React.FC<SessionItemProps> = (props) => {
  const { t } = useI18n();
  const {
    session,
    activeSessionId,
    editingItem,
    activeMenu,
    loadingSessionIds,
    generatingTitleSessionIds,
    newlyTitledSessionIds,
    groups,
    editInputRef,
    menuRef,
    onSelectSession,
    onTogglePinSession,
    onDeleteSession,
    onDuplicateSession,
    onOpenExportModal,
    onMoveSessionToGroup,
    handleStartEdit,
    handleRenameConfirm,
    handleRenameKeyDown,
    setEditingItem,
    toggleMenu,
    setActiveMenu,
    draggingSessionId,
    onSessionDragStart,
    onSessionDragEnd,
  } = props;

  const [isRightClickAnimating, setIsRightClickAnimating] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const isActive = activeMenu === session.id;
  const displayTitle = session.title === 'New Chat' ? t('newChat') : session.title;
  const isBeingDragged = draggingSessionId === session.id;
  const completedOutcome = useChatStore((state) => state.completedSessions[session.id]);

  // A slight pointer move (< 10px) while pressing is a jittery click, not a
  // drag. Native HTML5 drag has a ~5px threshold, so a 6px wiggle triggers
  // dragstart/end but never fires click. Treat such a micro-drag as a click so
  // the session still activates, without disturbing real drag-to-group.
  const isMicroDrag = (e: React.DragEvent<HTMLAnchorElement>) => {
    const start = dragStartRef.current;
    if (!start) return false;
    return Math.hypot(e.clientX - start.x, e.clientY - start.y) < 10 && e.timeStamp - start.t < 500;
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsRightClickAnimating(true);
    setActiveMenu(session.id);
    setTimeout(() => setIsRightClickAnimating(false), RIGHT_CLICK_MENU_FEEDBACK_MS);
  };

  const handleDragStart = (e: React.DragEvent<HTMLAnchorElement>) => {
    dragStartRef.current = { x: e.clientX, y: e.clientY, t: e.timeStamp };
    e.dataTransfer.setData(SESSION_DRAG_TYPE, session.id);
    e.dataTransfer.effectAllowed = 'move';
    onSessionDragStart(session.id);

    // Build a compact, unobtrusive drag image (pin + title) so the ghost does
    // not show the whole row snapshot. It must be in the DOM at dragstart, and
    // is removed on the next tick after setDragImage captures it.
    const ghost = document.createElement('div');
    ghost.className =
      'fixed top-0 left-0 z-[9999] pointer-events-none flex items-center gap-2 rounded-md bg-[var(--theme-bg-primary)] px-2.5 py-1.5 text-sm font-medium text-[var(--theme-text-primary)] shadow-lg';
    if (session.isPinned) {
      const pinIcon = document.createElement('span');
      pinIcon.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z"/></svg>';
      ghost.appendChild(pinIcon);
    }
    const label = document.createElement('span');
    label.textContent = displayTitle;
    ghost.appendChild(label);
    document.body.appendChild(ghost);

    e.dataTransfer.setDragImage(ghost, 12, 12);

    // A drop landing outside the app never fires onDragEnd, so schedule the
    // removal here regardless.
    window.setTimeout(() => ghost.remove(), 0);
  };

  const handleDragEnd = (e: React.DragEvent<HTMLAnchorElement>) => {
    if (isMicroDrag(e)) {
      dragStartRef.current = null;
      onSelectSession(session.id);
    }
    onSessionDragEnd();
  };

  return (
    <li
      onContextMenu={handleContextMenu}
      className={`group relative rounded-lg my-0.5 transition-all duration-150 ease-out ${
        session.id === activeSessionId || isRightClickAnimating ? 'bg-[var(--theme-bg-accent)]/10' : ''
      } ${newlyTitledSessionIds.has(session.id) ? 'title-update-animate' : ''} ${isActive ? 'z-20' : ''}`}
    >
      <div
        className={`relative w-full text-left pl-2.5 pr-1 py-2 text-sm transition-colors rounded-lg text-[var(--theme-text-primary)] ${
          session.id === activeSessionId ? 'font-medium' : 'hover:bg-[var(--theme-bg-tertiary)]'
        } ${isBeingDragged ? 'opacity-40 scale-[0.98]' : ''}`}
      >
        {editingItem?.type === 'session' && editingItem.id === session.id ? (
          <input
            ref={editInputRef}
            type="text"
            value={editingItem.title}
            onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
            onBlur={handleRenameConfirm}
            onKeyDown={handleRenameKeyDown}
            className="flex-grow bg-transparent border border-[var(--theme-border-focus)] rounded-md px-1 py-0 text-sm w-full"
          />
        ) : (
          <a
            href={`/chat/${session.id}`}
            draggable
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onClick={(e) => {
              if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
                e.preventDefault();
                onSelectSession(session.id);
              }
            }}
            onDoubleClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleStartEdit(session);
            }}
            className="flex w-full min-w-0 items-center pr-8 no-underline text-inherit"
            aria-current={session.id === activeSessionId ? 'page' : undefined}
          >
            {session.isPinned && (
              <Pin size={12} className="mr-2 text-[var(--theme-text-link)] flex-shrink-0" strokeWidth={2} />
            )}
            <span className="font-medium truncate" title={displayTitle}>
              {generatingTitleSessionIds.has(session.id) ? (
                <div className="flex items-center gap-2 text-xs text-[var(--theme-text-tertiary)]">
                  <LoadingDots />
                  <span>{t('generatingTitle')}</span>
                </div>
              ) : (
                displayTitle
              )}
            </span>
          </a>
        )}
        {loadingSessionIds.has(session.id) ? (
          <span className="absolute right-1 top-1/2 -translate-y-1/2">
            <LoadingDots />
          </span>
        ) : (
          <>
            {completedOutcome && (
              <span
                className={`absolute right-2 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full ${
                  completedOutcome === 'error' ? 'bg-[#ef4444]' : 'bg-[#22c55e]'
                }`}
                title={t(completedOutcome === 'error' ? 'sessionCompletedWithError' : 'sessionCompleted')}
                aria-label={t(completedOutcome === 'error' ? 'sessionCompletedWithError' : 'sessionCompleted')}
              />
            )}
            {!generatingTitleSessionIds.has(session.id) && (
              <button
                onClick={(e) => toggleMenu(e, session.id)}
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-[var(--theme-bg-secondary)] p-1 text-[var(--theme-text-tertiary)] opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus:opacity-100 focus:pointer-events-auto transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--theme-border-focus)]"
              >
                <MoreHorizontal size={16} strokeWidth={2} />
              </button>
            )}
          </>
        )}
      </div>
      {activeMenu === session.id && (
        <SessionItemMenu
          session={session}
          menuRef={menuRef}
          groups={groups}
          onMoveSessionToGroup={onMoveSessionToGroup}
          onStartEdit={() => {
            handleStartEdit(session);
            setActiveMenu(null);
          }}
          onTogglePin={() => {
            onTogglePinSession(session.id);
            setActiveMenu(null);
          }}
          onDuplicate={() => {
            onDuplicateSession(session.id);
            setActiveMenu(null);
          }}
          onExport={() => {
            onOpenExportModal(session.id);
            setActiveMenu(null);
          }}
          onDelete={() => {
            onDeleteSession(session.id);
            setActiveMenu(null);
          }}
        />
      )}
    </li>
  );
};
