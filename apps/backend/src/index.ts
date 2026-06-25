import 'reflect-metadata';
import '#infrastructure/di/container.setup.js';
import { container } from 'tsyringe';
import { Application } from './application.js';

const app = container.resolve(Application);
app.run();
