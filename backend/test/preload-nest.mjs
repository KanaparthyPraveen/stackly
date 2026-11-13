/**
 * Jest (ESM mode) setup for the e2e suites.
 *
 * NestJS ships as ES modules while @nestjs/throttler is CommonJS and
 * `require()`s @nestjs/common. If the first import of @nestjs/common happens
 * as part of loading the application graph, that require lands in the middle
 * of the ES module evaluation and Node refuses it ("require() ES Module in a
 * cycle"). Evaluating the Nest packages up front avoids the cycle.
 */
import '@nestjs/common';
import '@nestjs/core';
