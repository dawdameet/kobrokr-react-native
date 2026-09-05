import { Slot, usePathname } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View } from 'react-native';
import BottomNav from '../components/BottomNav';
import AuthGate from '../components/AuthGate';

export default function RootLayout() {
  const pathname = usePathname();
  const hideNavOn = ['/login', '/signup', '/onboarding', '/add-property'];
  const isDetailsRoute = pathname.startsWith('/properties/');
  const isHidden = hideNavOn.includes(pathname) || isDetailsRoute || pathname === '/';

  return (
    <SafeAreaProvider>
      <AuthGate>
        <View style={{ flex: 1 }}>
          <Slot />
          {!isHidden && <BottomNav />}
        </View>
      </AuthGate>
    </SafeAreaProvider>
  );
}

