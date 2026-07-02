import { ElizaService } from './gen/eliza_pb.js';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * ConnectRPC routes definitions.
 * @param {import('@connectrpc/connect').ConnectRouter} router
 * @param {import('@nestjs/common').INestApplication} app
 * @param {Function} registerServerReflectionFromUint8Array
 */
export default (router, app, registerServerReflectionFromUint8Array) => {
  router.service(ElizaService, {
    async say(req) {
      return {
        sentence: `You said: "${req.sentence}"`,
      };
    },
  });

  // Registrar Reflection API utilizando el descriptor binario compilado
  if (registerServerReflectionFromUint8Array) {
    try {
      let descriptorBytes;
      try {
        descriptorBytes = readFileSync(join(__dirname, 'gen/descriptor.bin'));
      } catch {
        descriptorBytes = readFileSync(
          join(__dirname, '../gen/descriptor.bin'),
        );
      }
      registerServerReflectionFromUint8Array(router, descriptorBytes);
    } catch (error) {
      console.error('❌ Error al registrar gRPC Server Reflection:', error);
    }
  }
};
