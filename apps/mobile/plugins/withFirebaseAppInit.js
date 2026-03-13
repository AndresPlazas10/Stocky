const { withMainApplication } = require('@expo/config-plugins');

function addJavaImport(source, importLine) {
  if (source.includes(importLine)) return source;
  const packageMatch = source.match(/^package\s+[^\n]+;\n/m);
  if (!packageMatch) return source;
  const insertAt = packageMatch.index + packageMatch[0].length;
  return `${source.slice(0, insertAt)}\n${importLine}\n${source.slice(insertAt)}`;
}

const KOTLIN_SNIPPET = [
  '    try {',
  '      val firebaseAppClass = Class.forName("com.google.firebase.FirebaseApp")',
  '      val initializeApp = firebaseAppClass.getMethod("initializeApp", android.content.Context::class.java)',
  '      initializeApp.invoke(null, this)',
  '    } catch (_: Throwable) {',
  '      // Firebase SDK not linked in this variant; ignore.',
  '    }',
].join('\n');

const JAVA_SNIPPET = [
  '    try {',
  '      Class<?> firebaseAppClass = Class.forName("com.google.firebase.FirebaseApp");',
  '      java.lang.reflect.Method initializeApp = firebaseAppClass.getMethod("initializeApp", android.content.Context.class);',
  '      initializeApp.invoke(null, this);',
  '    } catch (Throwable ignored) {',
  '      // Firebase SDK not linked in this variant; ignore.',
  '    }',
].join('\n');

function injectFirebaseInitKotlin(source) {
  const normalized = source
    .replace(/\nimport com\.google\.firebase\.FirebaseApp\s*\n/g, '\n')
    .replace(/\n\s*FirebaseApp\.initializeApp\(this\)\s*\n/g, '\n');

  if (normalized.includes('Class.forName("com.google.firebase.FirebaseApp")')) {
    return normalized;
  }

  if (normalized.includes('super.onCreate()')) {
    return normalized.replace(
      'super.onCreate()',
      `super.onCreate()\n${KOTLIN_SNIPPET}`,
    );
  }

  return normalized.replace(
    /override fun onCreate\(\)\s*\{/,
    (match) => `${match}\n${KOTLIN_SNIPPET}`,
  );
}

function injectFirebaseInitJava(source) {
  const normalized = source
    .replace(/\nimport com\.google\.firebase\.FirebaseApp;\s*\n/g, '\n')
    .replace(/\n\s*FirebaseApp\.initializeApp\(this\);\s*\n/g, '\n');

  const withImports = addJavaImport(normalized, 'import android.content.Context;');
  if (withImports.includes('Class.forName("com.google.firebase.FirebaseApp")')) {
    return withImports;
  }

  if (withImports.includes('super.onCreate();')) {
    return withImports.replace(
      'super.onCreate();',
      `super.onCreate();\n${JAVA_SNIPPET}`,
    );
  }

  return withImports.replace(
    /public void onCreate\(\)\s*\{/,
    (match) => `${match}\n${JAVA_SNIPPET}`,
  );
}

module.exports = function withFirebaseAppInit(config) {
  return withMainApplication(config, (config) => {
    const language = config.modResults.language;
    const source = config.modResults.contents;

    if (language === 'kt') {
      config.modResults.contents = injectFirebaseInitKotlin(source);
      return config;
    }

    config.modResults.contents = injectFirebaseInitJava(source);
    return config;
  });
};
