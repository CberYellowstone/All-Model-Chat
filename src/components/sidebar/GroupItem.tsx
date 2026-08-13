import React, { useEffect, useRef } from 'react';
import { ChevronDown, MoreHorizontal } from 'lucide-react';
import { type ChatGroup, type SavedChatSession } from '@/types';
import type { SessionItem } from './SessionItem';
import { GroupItemMenu } from './GroupItemMenu';
import { LimitedSessionList } from './LimitedSessionList';
import { isSessionDrag } from './sidebarDragTypes';

export type SessionItemPassedProps = Omit<React.ComponentProps<typeof SessionItem>, 'session'>;

// Auto-expand delay: hold over a collapsed group this long to pop it open.
const DRAG_HOVER_EXPAND_MS = 600;

interface GroupItemProps extends SessionItemPassedProps {
  group: ChatGroup;
  sessions: SavedChatSession[];
  editingItem: { type: 'session' | 'group'; id: string; title: string } | null;
  dragOverId: string | null;
  onToggleGroupExpansion: (groupId: string) => void;
  handleGroupStartEdit: (item: ChatGroup) => void;
  handleDrop: (e: React.DragEvent, groupId: string | null) => void;
  handleDragOver: (e: React.DragEvent) => void;
  setDragOverId: (id: string | null) => void;
  setEditingItem: (item: { type: 'session' | 'group'; id: string; title: string } | null) => void;
  onDeleteGroup: (groupId: string) => void;
  onNewChatInGroup: (groupId: string) => void;
}

export const GroupItem: React.FC<GroupItemProps> = (props) => {
  const {
    group,
    sessions,
    editingItem,
    dragOverId,
    onToggleGroupExpansion,
    handleGroupStartEdit,
    handleDrop,
    handleDragOver,
    setDragOverId,
    setEditingItem,
    onDeleteGroup,
    onNewChatInGroup,
    editInputRef,
    handleRenameConfirm,
    handleRenameKeyDown,
    toggleMenu,
    activeMenu,
    menuRef,
    setActiveMenu,
    ...sessionItemProps
  } = props;

  // Auto-expand: while a session is hovered over this group, start a timer that
  // expands a collapsed group after a short delay. Cancelled when the drag
  // leaves or the group is already expanded.
  const expandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (expandTimerRef.current) clearTimeout(expandTimerRef.current);
    },
    [],
  );

  const startAutoExpand = (event: React.DragEvent) => {
    if (!isSessionDrag(event)) return;
    if (group.isExpanded === false) {
      if (expandTimerRef.current) clearTimeout(expandTimerRef.current);
      expandTimerRef.current = setTimeout(() => onToggleGroupExpansion(group.id), DRAG_HOVER_EXPAND_MS);
    }
  };

  const cancelAutoExpand = () => {
    if (expandTimerRef.current) {
      clearTimeout(expandTimerRef.current);
      expandTimerRef.current = null;
    }
  };

  const childSessionItemProps: SessionItemPassedProps = {
    activeSessionId: sessionItemProps.activeSessionId,
    editingItem,
    activeMenu,
    loadingSessionIds: sessionItemProps.loadingSessionIds,
    generatingTitleSessionIds: sessionItemProps.generatingTitleSessionIds,
    newlyTitledSessionIds: sessionItemProps.newlyTitledSessionIds,
    editInputRef,
    menuRef,
    onSelectSession: sessionItemProps.onSelectSession,
    onTogglePinSession: sessionItemProps.onTogglePinSession,
    onDeleteSession: sessionItemProps.onDeleteSession,
    onDuplicateSession: sessionItemProps.onDuplicateSession,
    onOpenExportModal: sessionItemProps.onOpenExportModal,
    onMoveSessionToGroup: sessionItemProps.onMoveSessionToGroup,
    groups: sessionItemProps.groups,
    handleStartEdit: sessionItemProps.handleStartEdit,
    handleRenameConfirm,
    handleRenameKeyDown,
    setEditingItem,
    toggleMenu,
    setActiveMenu,
    setDragOverId,
    draggingSessionId: sessionItemProps.draggingSessionId,
    onSessionDragStart: sessionItemProps.onSessionDragStart,
    onSessionDragEnd: sessionItemProps.onSessionDragEnd,
  };

  const isMenuOpenInGroup = activeMenu === group.id || sessions?.some((session) => session.id === activeMenu);

  return (
    <div
      onDragOver={(e) => {
        if (!isSessionDrag(e)) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        handleDragOver(e);
      }}
      onDrop={(e) => {
        cancelAutoExpand();
        handleDrop(e, group.id);
      }}
      onDragEnter={(e) => {
        if (!isSessionDrag(e)) return;
        e.preventDefault();
        e.stopPropagation();
        startAutoExpand(e);
        setDragOverId(group.id);
      }}
      onDragLeave={(e) => {
        cancelAutoExpand();
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDragOverId(null);
      }}
      onDragEnd={cancelAutoExpand}
      className={`rounded-lg transition-all duration-200 mb-1 ${dragOverId === group.id ? 'bg-[var(--theme-bg-accent)] bg-opacity-20 ring-2 ring-[var(--theme-bg-accent)] ring-inset ring-opacity-50' : ''} ${isMenuOpenInGroup ? 'relative z-20' : 'relative z-0'}`}
    >
      <details open={group.isExpanded ?? true} className="group/details">
        <summary
          className="list-none flex items-center justify-between px-1 py-2 rounded-lg cursor-pointer hover:bg-[var(--theme-bg-tertiary)] group"
          onClick={(e) => {
            if (e.detail > 1) {
              // 双击由 onDoubleClick 处理，跳过展开切换
              return;
            }
            e.preventDefault();
            onToggleGroupExpansion(group.id);
          }}
          onDoubleClick={(e) => {
            e.preventDefault();
            handleGroupStartEdit(group);
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <ChevronDown
              size={16}
              className="text-[var(--theme-text-tertiary)] transition-transform group-open/details:rotate-180 flex-shrink-0"
              strokeWidth={2}
            />
            {editingItem?.type === 'group' && editingItem.id === group.id ? (
              <input
                ref={editInputRef}
                type="text"
                value={editingItem.title}
                onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                onFocus={(e) => e.currentTarget.select()}
                onBlur={handleRenameConfirm}
                onKeyDown={handleRenameKeyDown}
                onClick={(e) => e.stopPropagation()}
                className="bg-transparent border border-[var(--theme-border-focus)] rounded-md px-1 py-0 text-sm w-full font-semibold"
              />
            ) : (
              <span className="font-semibold text-sm truncate text-[var(--theme-text-primary)]">{group.title}</span>
            )}
          </div>
          <button
            onClick={(e) => toggleMenu(e, group.id)}
            className="p-1 rounded-full text-[var(--theme-text-tertiary)] opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus:opacity-100 focus:pointer-events-auto transition-opacity"
          >
            <MoreHorizontal size={16} strokeWidth={2} />
          </button>
        </summary>
        {activeMenu === group.id && (
          <GroupItemMenu
            menuRef={menuRef}
            onNewChat={() => {
              onNewChatInGroup(group.id);
              setActiveMenu(null);
            }}
            onStartEdit={() => {
              handleGroupStartEdit(group);
              setActiveMenu(null);
            }}
            onDelete={() => {
              onDeleteGroup(group.id);
              setActiveMenu(null);
            }}
          />
        )}
        <LimitedSessionList sessions={sessions ?? []} sessionItemProps={childSessionItemProps} className="pl-1 pb-1" />
      </details>
    </div>
  );
};
