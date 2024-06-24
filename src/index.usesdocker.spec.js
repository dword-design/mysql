import { endent } from '@dword-design/functions';
import tester from '@dword-design/tester';
import testerPluginTmpDir from '@dword-design/tester-plugin-tmp-dir';
import { execa, execaCommand } from 'execa';
import fs from 'fs-extra';
import getPort from 'get-port';
import pWaitFor from 'p-wait-for';
import P from 'path';
import portReady from 'port-ready';

import self from './index.js';

const mysqlContainerName = '97c96812-b606-4a98-aa8a-4147932c08a2';

export default tester(
  {
    'query: blob': {
      schema: 'CREATE TABLE entities (foo BLOB NOT NULL)',
      async test() {
        await this.connection.query('INSERT INTO entities SET ?', [
          { foo: 'foo' },
        ]);

        expect(
          (await this.connection.query('SELECT foo FROM entities'))[0]
            .foo instanceof Buffer,
        ).toEqual(true);
      },
    },
    'query: casing': {
      schema: 'CREATE TABLE entities (title_foo text NOT NULL)',
      async test() {
        await this.connection.query('INSERT INTO entities SET ?', [
          { titleFoo: 'foo' },
        ]);

        expect(await this.connection.query('SELECT * FROM entities')).toEqual([
          { titleFoo: 'foo' },
        ]);
      },
    },
    'query: multiple statements select first': {
      schema: 'CREATE TABLE entities (title text NOT NULL)',
      async test() {
        await this.connection.query('INSERT INTO entities SET ?', [
          { title: 'foo' },
        ]);

        expect(
          (
            await this.connection.query(
              'INSERT INTO entities SET ?; SELECT * FROM entities',
              [{ title: 'bar' }],
            )
          )[1],
        ).toEqual([{ title: 'foo' }, { title: 'bar' }]);
      },
    },
    'query: multiple statements select second': {
      schema: 'CREATE TABLE entities (title text NOT NULL)',
      async test() {
        expect(
          (
            await this.connection.query(
              'INSERT INTO entities SET ?; SELECT * FROM entities',
              [{ title: 'foo' }],
            )
          )[1],
        ).toEqual([{ title: 'foo' }]);
      },
    },
    'query: multiple statements with semicolon in string': {
      schema: 'CREATE TABLE entities (title text NOT NULL)',
      async test() {
        await this.connection.query("INSERT INTO entities VALUES (';')");

        expect(await this.connection.query('SELECT * FROM entities')).toEqual([
          { title: ';' },
        ]);
      },
    },
    'query: named placeholder': {
      schema: 'CREATE TABLE entities (title text NOT NULL)',
      async test() {
        await this.connection.query('INSERT INTO entities SET :entity', {
          entity: { title: 'foo' },
        });

        expect(await this.connection.query('SELECT * FROM entities')).toEqual([
          { title: 'foo' },
        ]);
      },
    },
    'query: simple parameter': {
      schema: 'CREATE TABLE entities (foo text NOT NULL)',
      async test() {
        await this.connection.query('INSERT INTO entities VALUES (?)', ['foo']);

        expect(await this.connection.query('SELECT foo FROM entities')).toEqual(
          [{ foo: 'foo' }],
        );
      },
    },
    'query: works': {
      schema: 'CREATE TABLE entities (title text NOT NULL)',
      async test() {
        await this.connection.query('INSERT INTO entities SET ?', [
          { title: 'foo' },
        ]);

        expect(await this.connection.query('SELECT * FROM entities')).toEqual([
          { title: 'foo' },
        ]);
      },
    },
    'queryOne: works': {
      schema: 'CREATE TABLE entities (title text NOT NULL)',
      async test() {
        await this.connection.query('INSERT INTO entities SET ?', [
          { title: 'foo' },
        ]);

        expect(
          await this.connection.queryOne('SELECT * FROM entities'),
        ).toEqual({ title: 'foo' });
      },
    },
  },
  [
    testerPluginTmpDir(),
    {
      async afterEach() {
        this.connection.end();
        await execaCommand(`docker container stop ${mysqlContainerName}`);
      },
      transform: ({ schema, test }) =>
        async function () {
          await fs.outputFile(
            'schema.sql',
            endent`
              CREATE DATABASE IF NOT EXISTS db DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
              USE db;
      
              ${schema}
            `,
          );

          const port = await getPort();

          await execa('docker', [
            'run',
            '--rm',
            '-d',
            '-p',
            `${port}:3306`,
            '-v',
            `${P.resolve('schema.sql')}:/docker-entrypoint-initdb.d/schema.sql`,
            '-e',
            'MYSQL_ALLOW_EMPTY_PASSWORD=yes',
            '--name',
            mysqlContainerName,
            'mysql',
          ]);

          await portReady(port);

          // https://cweiske.de/tagebuch/docker-mysql-available.htm
          await pWaitFor(
            async () => {
              try {
                await execa('docker', [
                  'exec',
                  '-i',
                  mysqlContainerName,
                  'sh',
                  '-c',
                  'exec mysql --protocol TCP -e "SHOW DATABASES"',
                ]);

                return true;
              } catch {
                return false;
              }
            },
            { interval: 100 },
          );

          this.connection = await self.createPool({
            charset: 'utf8mb4_general_ci',
            database: 'db',
            port,
            user: 'root',
          });

          await test.call(this);
        },
    },
  ],
);
