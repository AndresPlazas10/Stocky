import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { logger } from '@/utils/logger';
import {
  Bell,
  LogOut,
  Image as ImageIcon,
  Check,
  X
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useNotifications } from '../../hooks/useNotifications.js';
import { WarmupStatusBadge } from '../WarmupStatusBadge';

interface PredefinedAvatar {
  id: number;
  initials: string;
  name: string;
  gradient: string;
}

interface NavbarProps {
  userName?: string;
  userEmail?: string;
  userRole?: string;
  businessId?: string;
  onSignOut?: () => void;
  warmupStatus?: { phase?: string; reason?: string } | null;
}

const predefinedAvatars: PredefinedAvatar[] = [
  { id: 1, initials: 'AD', name: 'Admin', gradient: 'from-primary-500 to-primary-700' },
  { id: 2, initials: 'MG', name: 'Manager', gradient: 'from-primary-600 to-secondary' },
  { id: 3, initials: 'DV', name: 'Dev', gradient: 'from-secondary to-primary-400' },
  { id: 4, initials: 'CH', name: 'Chef', gradient: 'from-primary-700 to-primary-500' },
  { id: 5, initials: 'OW', name: 'Owner', gradient: 'from-primary-400 to-secondary' },
  { id: 6, initials: 'ST', name: 'Staff', gradient: 'from-secondary to-primary-600' },
  { id: 7, initials: 'SR', name: 'Server', gradient: 'from-primary-500 to-primary-800' },
  { id: 8, initials: 'BR', name: 'Bar', gradient: 'from-primary-800 to-primary-500' },
  { id: 9, initials: 'HG', name: 'Host', gradient: 'from-primary-300 to-primary-600' },
  { id: 10, initials: 'KS', name: 'Kitchen', gradient: 'from-primary-600 to-primary-400' },
];

const AVATAR_STORAGE_KEY = 'userAvatar';

function getSavedAvatar(): PredefinedAvatar | null {
  try {
    const saved = localStorage.getItem(AVATAR_STORAGE_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    const valid = predefinedAvatars.find((a) => a.id === parsed?.id);
    return valid || null;
  } catch (err) {
    logger.warn('navbar:get_saved_avatar failed', err);
    return null;
  }
}

function saveAvatar(avatar: PredefinedAvatar) {
  try {
    localStorage.setItem(AVATAR_STORAGE_KEY, JSON.stringify(avatar));
  } catch (err) {
    logger.warn('navbar:save_avatar failed', err);
  }
}

export const Navbar = React.memo(function Navbar({
  userName = "Admin",
  userEmail = "admin@stockypos.app",
  userRole = "Administrador",
  businessId,
  onSignOut,
  warmupStatus = null
}: NavbarProps) {
  const [selectedAvatar, setSelectedAvatar] = useState<PredefinedAvatar>(() => getSavedAvatar() || predefinedAvatars[0]);
  const [showAvatarModal, setShowAvatarModal] = useState(false);

  const { notifications, loading: notificationsLoading, markAsRead, markAllAsRead } = useNotifications(businessId);

  const unreadCount = notifications.filter((n: { unread: boolean }) => n.unread).length;

  useEffect(() => {
    saveAvatar(selectedAvatar);
  }, [selectedAvatar]);

  const handleAvatarSelect = (avatar: PredefinedAvatar) => {
    setSelectedAvatar(avatar);
    setShowAvatarModal(false);
  };

  return (
    <>
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-gray-200 dark:bg-primary-900/80 dark:border-primary-700"
    >
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
        {/* Left Section - Welcome Message */}
        <div className="flex-1 ml-12 lg:ml-0">
          <h2 className="text-base sm:text-lg font-bold truncate" style={{ color: '#000000' }}>
            Bienvenido, {userName}
          </h2>
          <p className="text-xs sm:text-sm font-semibold" style={{ color: '#1f2937' }}>
            {userRole}
          </p>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2 sm:gap-4">
          <WarmupStatusBadge status={warmupStatus} />

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="cursor-pointer relative p-2 rounded-2xl hover:bg-primary-50 transition-colors duration-200 group">
                <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 group-hover:text-primary transition-colors duration-200" />
                {unreadCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-red-500 text-white text-[10px] sm:text-xs rounded-full flex items-center justify-center font-medium"
                  >
                    {unreadCount}
                  </motion.span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-80">
              <DropdownMenuLabel className="text-primary font-semibold">
                Notificaciones
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="max-h-[400px] overflow-y-auto">
                {notificationsLoading ? (
                  <div className="p-8 text-center text-gray-500 text-sm">
                    Cargando notificaciones...
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 text-sm">
                    No hay notificaciones nuevas
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <DropdownMenuItem
                      key={notification.id}
                      onClick={() => markAsRead(notification.id)}
                      className={cn(
                        "flex flex-col items-start gap-1 p-3 cursor-pointer hover:bg-gray-50",
                        notification.unread && "bg-gray-50/50"
                      )}
                    >
                      <div className="flex items-start justify-between w-full">
                        <div className="flex-1">
                          <p className="font-medium text-sm text-primary">
                            {notification.title}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            {notification.message}
                          </p>
                        </div>
                        {notification.unread && (
                          <div className="w-2 h-2 rounded-full bg-gray-500 mt-1" />
                        )}
                      </div>
                      <span className="text-xs text-gray-400">{notification.time}</span>
                    </DropdownMenuItem>
                  ))
                )}
              </div>
              {notifications.length > 0 && unreadCount > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={markAllAsRead}
                    className="cursor-pointer justify-center text-primary font-medium transition-colors duration-200"
                  >
                    Marcar todas como leídas
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="cursor-pointer flex items-center gap-3 p-2 rounded-2xl hover:bg-primary-50 transition-colors duration-200 group">
                <Avatar className={`w-9 h-9 border-2 border-primary-200 bg-gradient-to-br ${selectedAvatar.gradient}`}>
                  <AvatarFallback className={`bg-gradient-to-br ${selectedAvatar.gradient} text-white text-sm font-bold`}>
                    {selectedAvatar.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-semibold text-gray-900">{userName}</p>
                  <Badge variant="secondary" className="text-xs px-2 py-0 bg-gray-200 text-gray-800">
                    {userRole}
                  </Badge>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-semibold text-gray-900">{userName}</p>
                  <p className="text-xs text-gray-600">{userEmail}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer" onClick={() => setShowAvatarModal(true)}>
                <ImageIcon className="mr-2 h-4 w-4 text-primary" />
                <span>Cambiar Avatar</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer text-red-600 focus:text-red-600" onClick={onSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Cerrar Sesión</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </motion.header>

      {/* Modal de Selección de Avatar - Fuera del header */}
      <AnimatePresence>
        {showAvatarModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            style={{ zIndex: 9999 }}
            onClick={() => setShowAvatarModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="sticky top-0 bg-white p-6 border-b border-gray-200 rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold text-primary">Elige tu Avatar</h3>
                    <p className="text-sm text-gray-500 mt-1">Selecciona un avatar para personalizar tu perfil</p>
                  </div>
                  <button
                    onClick={() => setShowAvatarModal(false)}
                    className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-5 gap-4">
                {predefinedAvatars.map((avatar) => (
                  <motion.button
                    key={avatar.id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleAvatarSelect(avatar)}
                    className={cn(
                      "cursor-pointer relative flex flex-col items-center gap-2 p-4 rounded-2xl transition-all duration-200",
                      selectedAvatar.id === avatar.id
                        ? "bg-primary-100 ring-2 ring-primary shadow-lg"
                        : "bg-gray-50 hover:bg-gray-100"
                    )}
                  >
                    <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${avatar.gradient} flex items-center justify-center text-lg font-bold text-white`}>
                      {avatar.initials}
                    </div>
                    <span className="text-xs font-medium text-gray-700 text-center">
                      {avatar.name}
                    </span>
                    {selectedAvatar.id === avatar.id && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center"
                      >
                        <Check className="w-4 h-4 text-white" />
                      </motion.div>
                    )}
                  </motion.button>
                ))}
              </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setShowAvatarModal(false)}
                    className="px-4 py-2 rounded-xl border border-gray-300 hover:bg-gray-50 transition-colors font-medium text-gray-700"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => setShowAvatarModal(false)}
                    className="cursor-pointer px-4 py-2 rounded-xl bg-primary text-white hover:bg-primary-700 transition-all duration-200 font-medium"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});
