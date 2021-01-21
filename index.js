#!/usr/bin/env node
const yargs = require('yargs');
const walk = require('walkdir');
const dayjs = require('dayjs');
const { spawnSync } = require('child_process');

const indent = ' '.repeat(2);
const indent2 = indent.repeat(2);
const indent3 = indent.repeat(3);

const today = dayjs();
const after = today.subtract(8, 'day');
const argv = yargs(process.argv.slice(2))
  .usage('$0')
  .option('author', {
    alias: 'a',
    default: 'chronolai',
  })
  .option('after', {
    default: after.format('YYYY-MM-DD'),
  })
  .option('before', {
    default: today.format('YYYY-MM-DD'),
  })
  .option('depth', {
    alias: 'd',
    default: 2,
  })
  .option('type', {
    alias: 't',
    default: 'shell',
  })
  .alias('v', 'version')
  .alias('h', 'help')
  .help('help')
  .argv;

if (argv._.length === 0) {
  yargs.showHelp();
  return;
}
// console.log(argv);

const root = require('path').resolve(argv._[0]);
const options = {
  max_depth: argv.depth,
};
const repos = walk.sync(root, options)
  .filter(path => path.match(/\.git$/))
  .map(path => path.replace('/.git', ''))
  .map(path => {
    process.chdir(path);
    const project = path.replace(`${root}/`, '');
    const git_st = spawnSync('git', ['status']).stdout.toString();
    const git_br = spawnSync('git', ['branch']).stdout.toString();
    const status = git_st;
    const branches = git_br.split('\n')
      .filter(br => br.length > 0)
      .map(branch => {
        const name = branch.replace(/[\*\s]/gi, '');
        const head = branch.includes('*');
        const git_lg = spawnSync('git', [
          'log',
          '--graph',
          '--abbrev-commit',
          '--pretty=oneline',
          `--author=${argv.author}`,
          `--after=${argv.after}`,
          `--before=${argv.before}`,
          name,
        ]).stdout.toString();
        const commits = git_lg.split('\n').filter(br => br.length > 0);
        return {
          name,
          head,
          status,
          commits,
        };
      });
    const hasChanged = status.includes('modified');
    const hasCommits = branches.reduce((acc, val) => acc + val.commits.length, 0) > 0;
    return {
      name: project,
      path,
      status,
      branches,
      hasChanged,
      hasCommits,
    };
  });

if (argv.type === 'json') {
  console.log(JSON.stringify(repos));
} else if (argv.type === 'md') {
  console.log('---');
  console.log(`id: weekly_${argv.after}_${argv.before}`);
  console.log(`title: 'Weekly Report: ${argv.after} ~ ${argv.before}'`);
  console.log('---');
  console.log();
  console.log();

  console.log('## Doing');
  repos.forEach(repo => {
    if (!repo.hasChanged || repo.hasCommits) {
      return;
    }
    const title = `${repo.name} ${repo.hasChanged ? '(*)' : ''}`;
    console.log(`- ${title}`);
  });
  console.log('');

  console.log('## Done');
  repos.forEach(repo => {
    if (!repo.hasCommits) {
      return;
    }
    const title = `${repo.name} ${repo.hasChanged ? '(*)' : ''}`;
    console.log(`### ${title}`);
    repo.branches.forEach((br) => {
      if (br.commits.length > 0) {
        console.log(`#### ${br.name}`);
        console.log('```');
        br.commits.forEach((ci) => {
          console.log(`${ci}`);
        });
        console.log('```');
      }
    });
  });
  console.log('');
} else {
  console.log('-'.repeat(40));
  console.log(` Weekly Report: ${argv.after} ~ ${argv.before}`);
  console.log('-'.repeat(40));
  console.log('');

  console.log('Doing:');
  repos.forEach(repo => {
    if (!repo.hasChanged || repo.hasCommits) {
      return;
    }
    const title = `${repo.name} ${repo.hasChanged ? '(*)' : ''}`;
    console.log(`${indent}${title}`);
  });
  console.log('');

  console.log('Done:');
  repos.forEach(repo => {
    if (!repo.hasCommits) {
      return;
    }
    const title = `${repo.name} ${repo.hasChanged ? '(*)' : ''}`;
    console.log(`${indent}${title}`);
    repo.branches.forEach((br) => {
      if (br.commits.length > 0) {
        console.log(`${indent2}- ${br.name}`);
        br.commits.forEach((ci) => {
          console.log(`${indent3}${ci}`);
        });
      }
    });
    console.log('');
  });
}

