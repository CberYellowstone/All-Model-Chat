import React, { useState, type RefObject } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { SquarePen, Trash2, Pin, PinOff, Download, Copy, FolderKanban, ChevronLeft } from 'lucide-react';
import { type ChatGroup, type SavedChatSession } from '@/types';
import {
  MENU_ITEM_BUTTON_CLASS,
  MENU_ITEM_DEFAULT_STATE_CLASS,
  MENU_ITEM_DANGER_STATE_CLASS,
  MENU_PANEL_CLASS,
} from '@/constants/menuClasses';

interface SessionItemMenuProps {
  session: SavedChatSession;
  menuRef: RefObject<HTMLDivElement>;
  groups: ChatGroup[];
  onMoveSessionToGroup: (sessionId: string, groupId: string | null) => void;
  onStartEdit: () => void;
  onTogglePin: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onDelete: () => void;
}

export const SessionItemMenu: React.FC<SessionItemMenuProps> = ({
  session,
  menuRef,
  groups,
  onMoveSessionToGroup,
  onStartEdit,
  onTogglePin,
  onDuplicate,
  onExport,
  onDelete,
}) => {
  const { t } = useI18n();
  const [showGroupPicker, setShowGroupPicker] = useState(false);

  if (showGroupPicker) {
    return (
      <div ref={menuRef} className={`${MENU_PANEL_CLASS} top-9 z-10`}>
        <button
          onClick={() => setShowGroupPicker(false)}
          className={`${MENU_ITEM_BUTTON_CLASS} ${MENU_ITEM_DEFAULT_STATE_CLASS} border-b border-[var(--theme-border-secondary)]`}
        >
          <ChevronLeft size={14} /> <span>{t('back')}</span>
        </button>
        <button
          onClick={() => {
            onMoveSessionToGroup(session.id, null);
            setShowGroupPicker(false);
          }}
          className={`${MENU_ITEM_BUTTON_CLASS} ${MENU_ITEM_DEFAULT_STATE_CLASS} ${!session.groupId ? 'text-[var(--theme-text-link)]' : ''}`}
        >
          <FolderKanban size={14} /> <span>{t('historyNoGroup')}</span>
        </button>
        {groups.map((group) => (
          <button
            key={group.id}
            onClick={() => {
              onMoveSessionToGroup(session.id, group.id);
              setShowGroupPicker(false);
            }}
            className={`${MENU_ITEM_BUTTON_CLASS} ${MENU_ITEM_DEFAULT_STATE_CLASS} ${session.groupId === group.id ? 'text-[var(--theme-text-link)]' : ''}`}
          >
            <FolderKanban size={14} />
            <span className="truncate">{group.title}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div ref={menuRef} className={`${MENU_PANEL_CLASS} top-9 z-10`}>
      <button onClick={onStartEdit} className={`${MENU_ITEM_BUTTON_CLASS} ${MENU_ITEM_DEFAULT_STATE_CLASS}`}>
        <SquarePen size={14} /> <span>{t('edit')}</span>
      </button>
      {groups.length > 0 && (
        <button
          onClick={() => setShowGroupPicker(true)}
          className={`${MENU_ITEM_BUTTON_CLASS} ${MENU_ITEM_DEFAULT_STATE_CLASS}`}
        >
          <FolderKanban size={14} /> <span>{t('historyMoveToGroup')}</span>
        </button>
      )}
      <button onClick={onTogglePin} className={`${MENU_ITEM_BUTTON_CLASS} ${MENU_ITEM_DEFAULT_STATE_CLASS}`}>
        {session.isPinned ? <PinOff size={14} /> : <Pin size={14} />}{' '}
        <span>{session.isPinned ? t('historyUnpin') : t('historyPin')}</span>
      </button>
      <button onClick={onDuplicate} className={`${MENU_ITEM_BUTTON_CLASS} ${MENU_ITEM_DEFAULT_STATE_CLASS}`}>
        <Copy size={14} /> <span>{t('historyDuplicate')}</span>
      </button>
      <button
        onClick={onExport}
        className={`${MENU_ITEM_BUTTON_CLASS} ${MENU_ITEM_DEFAULT_STATE_CLASS}`}
        title={t('exportChat')}
      >
        <Download size={14} /> <span>{t('exportChat')}</span>
      </button>
      <button onClick={onDelete} className={`${MENU_ITEM_BUTTON_CLASS} ${MENU_ITEM_DANGER_STATE_CLASS}`}>
        <Trash2 size={14} /> <span>{t('delete')}</span>
      </button>
    </div>
  );
};
