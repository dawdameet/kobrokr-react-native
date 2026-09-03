import { Slot, usePathname } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View } from 'react-native';
import BottomNav from '../components/BottomNav';

const queryClient = new QueryClient();

export default function RootLayout() {
  const pathname = usePathname();
  const hideNavOn = ['/login', '/signup', '/onboarding', '/add-property'];
  const isDetailsRoute = pathname.startsWith('/properties/');
  const isHidden = hideNavOn.includes(pathname) || isDetailsRoute || pathname === '/';

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <View style={{ flex: 1 }}>
          <Slot />
          {!isHidden && <BottomNav />}
        </View>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
