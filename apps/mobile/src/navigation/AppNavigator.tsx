import { useMemo } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  type DrawerContentComponentProps,
  type DrawerHeaderProps,
} from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetInfo } from '@react-native-community/netinfo';
import {
  getSectionsBySource,
  SECTION_BY_ID,
  SECTION_GROUP_LABELS,
  type SectionGroup,
  type SectionId,
  type SectionMeta,
} from './sections';
import type { RootDrawerParamList } from './types';
import { STOCKY_COLORS } from '../theme/tokens';
import { useDashboardContext } from '../screens/dashboard/DashboardContext';
import { DashboardSectionScreen } from '../screens/dashboard/DashboardSectionScreen';
import { isSectionEnabled } from '../config/features';
import { OfflineScreen } from '../ui/OfflineScreen';

const Drawer = createDrawerNavigator<RootDrawerParamList>();
const DRAWER_WIDTH = 244;

function Header({ navigation, route }: DrawerHeaderProps) {
  void route;
  const insets = useSafeAreaInsets();
  const { businessContext } = useDashboardContext();

  return (
    <View style={[styles.header, { paddingTop: insets.top + 6, minHeight: 64 + insets.top + 6 }]}>
      <Pressable onPress={navigation.openDrawer} style={styles.headerIconButton}>
        <Ionicons name="menu" size={36} color="#334155" />
      </Pressable>

      <View style={styles.headerCenter}>
        <Text style={styles.headerBusiness} numberOfLines={1}>
          {businessContext?.businessName || 'Stocky'}
        </Text>
      </View>

    </View>
  );
}

function DrawerContent({
  sections,
  source,
  ...props
}: DrawerContentComponentProps & {
  sections: SectionMeta[];
  source: 'owner' | 'employee';
}) {
  const { state, navigation } = props;
  const { session, signOut, businessContext } = useDashboardContext();
  const activeRouteName = state.routeNames[state.index];
  const roleLabel = source === 'employee' ? 'Empleado' : 'Administrador';
  const userLabel = String(
    session.user.user_metadata?.full_name
      || session.user.user_metadata?.name
      || session.user.user_metadata?.username
      || session.user.email?.split('@')[0]
      || 'Usuario',
  );

  const grouped = sections.reduce<Record<SectionGroup, SectionMeta[]>>((acc, section) => {
    acc[section.group].push(section);
    return acc;
  }, {
    principal: [],
    gestion: [],
    sistema: [],
  });

  const onNavigate = (sectionId: SectionId) => {
    navigation.navigate(sectionId as never);
  };

  return (
    <DrawerContentScrollView
      contentContainerStyle={styles.drawerContentContainer}
      style={styles.drawerContainer}
      bounces={false}
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustContentInsets={false}
    >
      <View style={styles.drawerHeaderBlock}>
        <Text style={styles.drawerBusiness}>{businessContext?.businessName || 'Stocky'}</Text>
        <Text style={styles.drawerUser} numberOfLines={1}>{userLabel}</Text>
        <View style={styles.drawerRolePill}>
          <Ionicons name="shield-checkmark-outline" size={13} color="#4338CA" />
          <Text style={styles.drawerRoleText}>{roleLabel}</Text>
        </View>
      </View>

      <View style={styles.drawerBody}>
        {(['principal', 'gestion', 'sistema'] as const).map((group) => {
          if (grouped[group].length === 0) return null;

          return (
            <View key={group} style={styles.groupBlock}>
              <Text style={styles.groupTitle}>{SECTION_GROUP_LABELS[group]}</Text>

              {grouped[group].map((section) => {
                const isActive = activeRouteName === section.id;
                const enabled = isSectionEnabled(section.id);

                return (
                  <Pressable
                    key={section.id}
                    onPress={() => onNavigate(section.id)}
                    style={styles.menuItem}
                    disabled={!enabled}
                  >
                    <Ionicons
                      name={section.icon}
                      size={30}
                      color={isActive ? '#2563EB' : '#6B7280'}
                    />
                    <Text style={[styles.menuItemText, isActive && styles.menuItemTextActive]}>
                      {section.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          );
        })}
      </View>

      <View style={styles.signOutWrapper}>
        <Pressable
          style={styles.signOutButton}
          onPress={() => {
            void signOut();
          }}
        >
          <Ionicons name="log-out-outline" size={24} color="#991B1B" />
          <Text style={styles.signOutText}>Cerrar sesión</Text>
        </Pressable>
      </View>
    </DrawerContentScrollView>
  );
}

function ScreenBySection({ sectionId }: { sectionId: SectionId }) {
  return <DashboardSectionScreen sectionId={sectionId} />;
}

export function AppNavigator() {
  const { businessContext, loadingBusiness } = useDashboardContext();
  const netInfo = useNetInfo();
  const source = businessContext?.source || 'owner';
  const allowedSectionIds = useMemo<SectionId[]>(() => {
    if (loadingBusiness) return ['home'];
    return getSectionsBySource(source);
  }, [loadingBusiness, source]);
  const allowedSections = useMemo(
    () => allowedSectionIds.map((id) => SECTION_BY_ID[id]).filter(Boolean),
    [allowedSectionIds],
  );
  const isOffline = netInfo.isInternetReachable === false || netInfo.isConnected === false;

  return (
    <View style={styles.appShell}>
      <NavigationContainer>
        <Drawer.Navigator
          key={`${source}:${loadingBusiness ? 'loading' : 'ready'}`}
          drawerContent={(props) => <DrawerContent {...props} sections={allowedSections} source={source} />}
          screenOptions={{
            drawerType: 'front',
            drawerStyle: styles.drawer,
            overlayColor: 'rgba(234, 241, 247, 0.72)',
            header: (props) => <Header {...props} />,
            sceneStyle: { backgroundColor: 'transparent' },
            swipeEdgeWidth: 24,
          }}
        >
          {allowedSections.map((section) => (
            <Drawer.Screen key={section.id} name={section.id} options={{ title: section.label }}>
              {() => <ScreenBySection sectionId={section.id} />}
            </Drawer.Screen>
          ))}
        </Drawer.Navigator>
      </NavigationContainer>
      {isOffline ? <OfflineScreen /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  appShell: {
    flex: 1,
  },
  drawer: {
    width: DRAWER_WIDTH,
    backgroundColor: 'transparent',
    borderRightWidth: 0,
    elevation: 0,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  drawerContainer: {
    backgroundColor: '#FFFFFF',
    marginVertical: 76,
    marginLeft: 8,
    marginRight: 8,
    padding: 0,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 12,
  },
  drawerContentContainer: {
    flexGrow: 1,
    paddingVertical: 0,
    paddingHorizontal: 0,
    backgroundColor: '#FFFFFF',
    paddingTop: 8,
    paddingBottom: 8,
  },
  drawerHeaderBlock: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
  },
  drawerBusiness: {
    color: '#111827',
    fontSize: 19,
    fontWeight: '700',
  },
  drawerUser: {
    marginTop: 4,
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '500',
  },
  drawerRolePill: {
    marginTop: 8,
    alignSelf: 'flex-start',
    minHeight: 24,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  drawerRoleText: {
    color: '#4338CA',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  drawerBody: {
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  groupBlock: {
    marginBottom: 14,
  },
  groupTitle: {
    color: '#6B7280',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  menuItem: {
    minHeight: 44,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuItemText: {
    flex: 1,
    color: '#4B5563',
    fontSize: 12,
    fontWeight: '500',
  },
  menuItemTextActive: {
    color: '#111827',
    fontWeight: '700',
  },
  signOutWrapper: {
    marginTop: 'auto',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },
  signOutButton: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
  },
  signOutText: {
    color: '#991B1B',
    fontSize: 11,
    fontWeight: '500',
  },
  header: {
    minHeight: 64,
    backgroundColor: STOCKY_COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.28)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
  },
  headerIconButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    justifyContent: 'center',
    paddingLeft: 2,
  },
  headerBusiness: {
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '800',
    maxWidth: 210,
  },
});
