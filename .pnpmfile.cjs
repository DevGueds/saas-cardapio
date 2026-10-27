// The generated client uses @prisma/client/runtime, not the optional Prisma CLI peer.
// Keep Studio, development engines and their unused database drivers out of API images.
module.exports = {
  hooks: {
    readPackage(pkg) {
      if (pkg.name === "@prisma/client" && pkg.version === "7.10.0") {
        if (pkg.peerDependencies) delete pkg.peerDependencies.prisma
        if (pkg.peerDependenciesMeta) delete pkg.peerDependenciesMeta.prisma
      }
      return pkg
    },
  },
}
