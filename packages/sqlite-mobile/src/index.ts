import * as SQLite from 'expo-sqlite';
import type { SqlDriver,SqlExecutor,SqlRow,SqlValue } from '@fasteners/sqlite-schema';
function executor(db:SQLite.SQLiteDatabase):SqlExecutor {return{run:async(sql,parameters=[])=>{if(parameters.length)await db.runAsync(sql,parameters);else await db.execAsync(sql);},all:async(sql,parameters=[])=>db.getAllAsync<SqlRow>(sql,parameters)};}
export async function openMobileDriver():Promise<SqlDriver> {
  const db=await SQLite.openDatabaseAsync('factory-solo-v1.sqlite3');
  await db.execAsync('PRAGMA foreign_keys=ON; PRAGMA journal_mode=DELETE;');
  const direct=executor(db);let queue:Promise<unknown>=Promise.resolve();
  const enqueue=<T>(operation:()=>Promise<T>):Promise<T>=>{const next=queue.then(operation);queue=next.catch(()=>undefined);return next;};
  return{
    run:(sql:string,parameters:SqlValue[]=[])=>enqueue(()=>direct.run(sql,parameters)),
    all:(sql:string,parameters:SqlValue[]=[])=>enqueue(()=>direct.all(sql,parameters)),
    transaction:<T>(operation:(tx:SqlExecutor)=>Promise<T>)=>enqueue(async()=>{let value:T|undefined;await db.withExclusiveTransactionAsync(async transaction=>{value=await operation(executor(transaction));});return value as T;}),
    close:()=>enqueue(()=>db.closeAsync()),
  };
}
