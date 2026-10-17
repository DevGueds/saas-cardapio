import { LocalCommerce } from "../modules/commerce/application/local-commerce"
import type { ApplicationServices } from "./presentation/ServicesProvider"
import { apiServices } from "./api-services"
import { Executor } from "../shared/application/execute"

import {
  BrowserExclusiveLock,
  DemoAccessPolicy,
  browserIds,
  consoleDiagnostics,
} from "../shared/infrastructure/browser-services"

import { CatalogCommands } from "../modules/catalog/application/catalog-commands"

import { LoadMenu } from "../modules/catalog/application/load-menu"

import { LocalMenuRepository } from "../modules/catalog/infrastructure/local-menu-repository"

import { browserStorageEvents } from "../modules/catalog/infrastructure/browser-storage-events"

import { initializeDemo } from "../modules/catalog/infrastructure/legacy-migration"

import { demoDirectory } from "../modules/catalog/infrastructure/demo-directory"

import { RestaurantCommands } from "../modules/restaurant/application/restaurant-commands"

import { PrepareOrder } from "../modules/checkout/application/prepare-order"

import { BrowserImageReader } from "../shared/infrastructure/browser-image-reader"

const executor = new Executor(consoleDiagnostics, browserIds)

const access = new DemoAccessPolicy(import.meta.env.VITE_APP_MODE)

const repository = new LocalMenuRepository(
  () => window.localStorage,
  new BrowserExclusiveLock(),
  browserStorageEvents,
  initializeDemo,
)

const demoServices: ApplicationServices = {
  mode: "demo",
  commerce: new LocalCommerce(repository, access, executor),
  menu: new LoadMenu(repository, demoDirectory, access, executor),

  catalog: new CatalogCommands(repository, access, browserIds, executor),

  restaurant: new RestaurantCommands(repository, access, executor),

  checkout: new PrepareOrder(repository, access, executor),

  images: new BrowserImageReader(executor),

  checkAdmin: () =>
    executor.run("access", "admin", async () => {
      access.assertAdmin()
    }),

  reportUnexpected: (cause?: unknown) =>
    executor.run("presentation", "render", async () => {
      throw cause ?? new Error("render_failure")
    }),
}

export const services =
  import.meta.env.VITE_APP_MODE === "api" ? apiServices() : demoServices
