import React, { type RefObject } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { MessageSquarePlus, SquarePen, Trash2 } from 'lucide-react';
import {
  MENU_ITEM_BUTTON_CLASS,
  MENU_ITEM_DEFAULT_STATE_CLASS,
  MENU_ITEM_DANGER_STATE_CLASS,
  MENU_PANEL_CLASS,
} from '@/constants/menuClasses';

interface GroupItemMenuProps {
  menuRef: RefObject<HTMLDivElement>;
  onNewChat: () => void;
  onStartEdit: () => void;
  onDelete: () => void;
}

export const GroupItemMenu: React.FC<GroupItemMenuProps> = ({ menuRef, onNewChat, onStartEdit, onDelete }) => {
  const { t } = useI18n();
  return (
    <div ref={menuRef} className="relative z-10">
      <div className={`${MENU_PANEL_CLASS} -top-1`}>
        <button onClick={onNewChat} className={`${MENU_ITEM_BUTTON_CLASS} ${MENU_ITEM_DEFAULT_STATE_CLASS}`}>
          <MessageSquarePlus size={14} /> <span>{t('historyNewChatInGroup')}</span>
        </button>
        <button onClick={onStartEdit} className={`${MENU_ITEM_BUTTON_CLASS} ${MENU_ITEM_DEFAULT_STATE_CLASS}`}>
          <SquarePen size={14} /> <span>{t('edit')}</span>
        </button>
        <button onClick={onDelete} className={`${MENU_ITEM_BUTTON_CLASS} ${MENU_ITEM_DANGER_STATE_CLASS}`}>
          <Trash2 size={14} /> <span>{t('delete')}</span>
        </button>
      </div>
    </div>
  );
};
