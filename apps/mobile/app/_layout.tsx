import { Stack } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { MobileProvider } from '../src/state';
if(!globalThis.crypto?.randomUUID)Object.defineProperty(globalThis,'crypto',{value:{randomUUID},configurable:true});
export default function Layout(){return <MobileProvider><Stack screenOptions={{headerShown:false}}/></MobileProvider>;}
