#!/bin/bash
# Phase 4 Memory & Knowledge Layer Test Runner

echo "🧪 Running Phase 4 Memory & Knowledge Layer Tests..."
echo ""

# Build the project
echo "📦 Building TypeScript..."
npm run build > /dev/null 2>&1

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful"
echo ""

# Run Phase 4 tests
echo "🔬 Running tests..."
node --test dist/__tests__/memory-indexer.test.js \
             dist/__tests__/memory-retriever-extended.test.js \
             dist/__tests__/memory-retriever.test.js \
             dist/__tests__/user-context-service.test.js \
             dist/__tests__/directory-initializer.test.js \
             dist/__tests__/memory-layer-integration.test.js

echo ""
echo "✅ Phase 4 tests completed!"
echo ""
echo "📊 View detailed results in PHASE4_TEST_SUMMARY.md"
