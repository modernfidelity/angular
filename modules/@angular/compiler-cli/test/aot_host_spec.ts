/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import * as ts from 'typescript';

import {CompilerHost} from '../src/compiler_host';

import {Directory, Entry, MockAotContext, MockCompilerHost} from './mocks';

describe('CompilerHost', () => {
  let context: MockAotContext;
  let host: ts.CompilerHost;
  let program: ts.Program;
  let hostNestedGenDir: CompilerHost;
  let hostSiblingGenDir: CompilerHost;

  beforeEach(() => {
    context = new MockAotContext('/tmp/src', clone(FILES));
    host = new MockCompilerHost(context);
    program = ts.createProgram(
        ['main.ts'], {
          module: ts.ModuleKind.CommonJS,
        },
        host);
    // Force a typecheck
    const errors = program.getSemanticDiagnostics();
    if (errors && errors.length) {
      throw new Error('Expected no errors');
    }
    hostNestedGenDir = new CompilerHost(
        program, host, {
          genDir: '/tmp/project/src/gen/',
          basePath: '/tmp/project/src',
          skipMetadataEmit: false,
          strictMetadataEmit: false,
          skipTemplateCodegen: false,
          trace: false
        },
        context);
    hostSiblingGenDir = new CompilerHost(
        program, host, {
          genDir: '/tmp/project/gen',
          basePath: '/tmp/project/src/',
          skipMetadataEmit: false,
          strictMetadataEmit: false,
          skipTemplateCodegen: false,
          trace: false
        },
        context);
  });

  describe('nestedGenDir', () => {
    it('should import node_module from factory', () => {
      expect(hostNestedGenDir.fileNameToModuleName(
                 '/tmp/project/node_modules/@angular/core.d.ts',
                 '/tmp/project/src/gen/my.ngfactory.ts', ))
          .toEqual('@angular/core');
    });

    it('should import factory from factory', () => {
      expect(hostNestedGenDir.fileNameToModuleName(
                 '/tmp/project/src/my.other.ngfactory.ts', '/tmp/project/src/my.ngfactory.ts'))
          .toEqual('./my.other.ngfactory');
      expect(hostNestedGenDir.fileNameToModuleName(
                 '/tmp/project/src/my.other.css.ts', '/tmp/project/src/a/my.ngfactory.ts'))
          .toEqual('../my.other.css');
      expect(hostNestedGenDir.fileNameToModuleName(
                 '/tmp/project/src/a/my.other.css.shim.ts', '/tmp/project/src/my.ngfactory.ts'))
          .toEqual('./a/my.other.css.shim');
    });

    it('should import application from factory', () => {
      expect(hostNestedGenDir.fileNameToModuleName(
                 '/tmp/project/src/my.other.ts', '/tmp/project/src/my.ngfactory.ts'))
          .toEqual('../my.other');
      expect(hostNestedGenDir.fileNameToModuleName(
                 '/tmp/project/src/my.other.ts', '/tmp/project/src/a/my.ngfactory.ts'))
          .toEqual('../../my.other');
      expect(hostNestedGenDir.fileNameToModuleName(
                 '/tmp/project/src/a/my.other.ts', '/tmp/project/src/my.ngfactory.ts'))
          .toEqual('../a/my.other');
    });
  });

  describe('siblingGenDir', () => {
    it('should import node_module from factory', () => {
      expect(hostSiblingGenDir.fileNameToModuleName(
                 '/tmp/project/node_modules/@angular/core.d.ts',
                 '/tmp/project/src/gen/my.ngfactory.ts'))
          .toEqual('@angular/core');
    });

    it('should import factory from factory', () => {
      expect(hostSiblingGenDir.fileNameToModuleName(
                 '/tmp/project/src/my.other.ngfactory.ts', '/tmp/project/src/my.ngfactory.ts'))
          .toEqual('./my.other.ngfactory');
      expect(hostSiblingGenDir.fileNameToModuleName(
                 '/tmp/project/src/my.other.css.ts', '/tmp/project/src/a/my.ngfactory.ts'))
          .toEqual('../my.other.css');
      expect(hostSiblingGenDir.fileNameToModuleName(
                 '/tmp/project/src/a/my.other.css.shim.ts', '/tmp/project/src/my.ngfactory.ts'))
          .toEqual('./a/my.other.css.shim');
    });

    it('should import application from factory', () => {
      expect(hostSiblingGenDir.fileNameToModuleName(
                 '/tmp/project/src/my.other.ts', '/tmp/project/src/my.ngfactory.ts'))
          .toEqual('./my.other');
      expect(hostSiblingGenDir.fileNameToModuleName(
                 '/tmp/project/src/my.other.ts', '/tmp/project/src/a/my.ngfactory.ts'))
          .toEqual('../my.other');
      expect(hostSiblingGenDir.fileNameToModuleName(
                 '/tmp/project/src/a/my.other.ts', '/tmp/project/src/my.ngfactory.ts'))
          .toEqual('./a/my.other');
    });
  });

  it('should be able to produce an import from main @angular/core', () => {
    expect(hostNestedGenDir.fileNameToModuleName(
               '/tmp/project/node_modules/@angular/core.d.ts', '/tmp/project/src/main.ts'))
        .toEqual('@angular/core');
  });

  it('should be able to produce an import from main to a sub-directory', () => {
    expect(hostNestedGenDir.fileNameToModuleName('lib/utils.ts', 'main.ts')).toEqual('./lib/utils');
  });

  it('should be able to produce an import from to a peer file', () => {
    expect(hostNestedGenDir.fileNameToModuleName('lib/collections.ts', 'lib/utils.ts'))
        .toEqual('./collections');
  });

  it('should be able to produce an import from to a sibling directory', () => {
    expect(hostNestedGenDir.fileNameToModuleName('lib/utils.ts', 'lib2/utils2.ts'))
        .toEqual('../lib/utils');
  });

  it('should be able to read a metadata file', () => {
    expect(hostNestedGenDir.getMetadataFor('node_modules/@angular/core.d.ts')).toEqual([
      {__symbolic: 'module', version: 2, metadata: {foo: {__symbolic: 'class'}}}
    ]);
  });

  it('should be able to read metadata from an otherwise unused .d.ts file ', () => {
    expect(hostNestedGenDir.getMetadataFor('node_modules/@angular/unused.d.ts')).toBeUndefined();
  });

  it('should be able to read empty metadata ', () => {
    expect(hostNestedGenDir.getMetadataFor('node_modules/@angular/empty.d.ts')).toEqual([]);
  });

  it('should return undefined for missing modules', () => {
    expect(hostNestedGenDir.getMetadataFor('node_modules/@angular/missing.d.ts')).toBeUndefined();
  });

  it('should add missing v2 metadata from v1 metadata and .d.ts files', () => {
    expect(hostNestedGenDir.getMetadataFor('metadata_versions/v1.d.ts')).toEqual([
      {__symbolic: 'module', version: 1, metadata: {foo: {__symbolic: 'class'}}}, {
        __symbolic: 'module',
        version: 2,
        metadata: {
          foo: {__symbolic: 'class'},
          Bar: {__symbolic: 'class', members: {ngOnInit: [{__symbolic: 'method'}]}},
          BarChild: {__symbolic: 'class', extends: {__symbolic: 'reference', name: 'Bar'}}
        }
      }
    ]);
  });
});

const dummyModule = 'export let foo: any[];';

const FILES: Entry = {
  'tmp': {
    'src': {
      'main.ts': `
        import * as c from '@angular/core';
        import * as r from '@angular/router';
        import * as u from './lib/utils';
        import * as cs from './lib/collections';
        import * as u2 from './lib2/utils2';
      `,
      'lib': {
        'utils.ts': dummyModule,
        'collections.ts': dummyModule,
      },
      'lib2': {'utils2.ts': dummyModule},
      'node_modules': {
        '@angular': {
          'core.d.ts': dummyModule,
          'core.metadata.json':
              `{"__symbolic":"module", "version": 2, "metadata": {"foo": {"__symbolic": "class"}}}`,
          'router': {'index.d.ts': dummyModule, 'src': {'providers.d.ts': dummyModule}},
          'unused.d.ts': dummyModule,
          'empty.d.ts': 'export declare var a: string;',
          'empty.metadata.json': '[]',
        }
      },
      'metadata_versions': {
        'v1.d.ts': `
          export declare class Bar {
            ngOnInit() {}
          }
          export declare class BarChild extends Bar {}
        `,
        'v1.metadata.json':
            `{"__symbolic":"module", "version": 1, "metadata": {"foo": {"__symbolic": "class"}}}`,
      }
    }
  }
};

function clone(entry: Entry): Entry {
  if (typeof entry === 'string') {
    return entry;
  } else {
    const result: Directory = {};
    for (const name in entry) {
      result[name] = clone(entry[name]);
    }
    return result;
  }
}
