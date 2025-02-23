import { Environment } from '@/environment/environment';
import { mongooseTestingModule } from '@/utils/testing-mongoose-module';
import {
  getConnectionToken,
  getModelToken,
  MongooseModule,
} from '@nestjs/mongoose';
import { TestingModule, Test } from '@nestjs/testing';
import { generateKeyPair } from 'crypto';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection, Model } from 'mongoose';
import { promisify } from 'util';
import { importOrGenerateKeys } from './import-or-generate-keys';
import { KeyName } from './key-name';
import { KeyPair } from './key-pair';
import { Key, KeyDocument, keySchema } from './models/key';

describe('importOrGenerateKeys()', () => {
  let mongod: MongoMemoryServer;
  let keyModel: Model<KeyDocument>;
  let environment: Environment;
  let connection: Connection;

  beforeAll(async () => (mongod = await MongoMemoryServer.create()));
  afterAll(async () => await mongod.stop());

  beforeEach(() => {
    environment = {
      keyStorePassphrase: 'FAKE_PASSPHRASE',
    } as Environment;
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        mongooseTestingModule(mongod),
        MongooseModule.forFeature([
          {
            name: Key.name,
            schema: keySchema,
          },
        ]),
      ],
      providers: [{ provide: Environment, useValue: environment }],
    }).compile();

    keyModel = module.get(getModelToken(Key.name));
    connection = module.get(getConnectionToken());
  });

  afterEach(async () => {
    await keyModel.deleteMany({});
    await connection.close();
  });

  describe('when the key is in the database', () => {
    let generatedKeyPair: KeyPair;

    beforeEach(async () => {
      const generateKeyPairAsync = promisify(generateKeyPair);
      generatedKeyPair = await generateKeyPairAsync('ec', {
        namedCurve: 'secp521r1',
      });

      await keyModel.create({
        name: KeyName.auth,
        publicKeyEncoded: generatedKeyPair.publicKey
          .export({
            format: 'pem',
            type: 'spki',
          })
          .toString(),
        privateKeyEncoded: generatedKeyPair.privateKey
          .export({
            format: 'pem',
            type: 'pkcs8',
            passphrase: environment.keyStorePassphrase,
            cipher: 'aes-256-cbc',
          })
          .toString(),
      });
    });

    it('should return the same keys', async () => {
      const keyPair = await importOrGenerateKeys(
        keyModel,
        KeyName.auth,
        environment.keyStorePassphrase,
      );
      expect(
        keyPair.publicKey.export({ format: 'pem', type: 'spki' }).toString(),
      ).toEqual(
        generatedKeyPair.publicKey
          .export({ format: 'pem', type: 'spki' })
          .toString(),
      );
    });
  });

  describe('when the key is not yet in the database', () => {
    it('should generate them', async () => {
      await importOrGenerateKeys(
        keyModel,
        KeyName.auth,
        environment.keyStorePassphrase,
      );
      expect(await keyModel.findOne({ name: KeyName.auth })).toBeTruthy();
    });
  });
});
