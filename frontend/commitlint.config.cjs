/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  plugins: [
    {
      rules: {
        'ticket-ref': ({ subject, type }) => {
          if (type === 'revert') return [true];
          if (subject && /^Merge\b/.test(subject)) return [true];
          const ok =
            !!subject && (/STACKRYZE-\d+/.test(subject) || subject.includes('no-ticket'));
          return [
            ok,
            'subject must include the Plane ticket id, e.g. "chore(scope): STACKRYZE-20 ..."',
          ];
        },
      },
    },
  ],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'hotfix',
        'chore',
        'docs',
        'refactor',
        'perf',
        'test',
        'ci',
        'build',
        'style',
        'revert',
      ],
    ],
    'scope-case': [2, 'always', 'kebab-case'],
    'subject-case': [2, 'never', ['upper-case', 'pascal-case', 'start-case']],
    'header-max-length': [2, 'always', 100],
    'body-max-line-length': [2, 'always', 100],
    'ticket-ref': [2, 'always'],
  },
};
