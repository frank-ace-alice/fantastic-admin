import { cloneDeep } from 'lodash-es'
import useSettingsStore from './settings'
import useUserStore from './user'
import useRouteStore from './route'
import type { Menu } from '#/global'

import { resolveRoutePath } from '@/utils'
import api from '@/api'
import menu from '@/menu'

function getDeepestPath(menu: Menu.recordRaw, rootPath = '') {
  let retnPath = ''
  if (menu.children) {
    const item = menu.children.find(item => item.meta?.sidebar !== false)
    if (item) {
      retnPath = getDeepestPath(item, resolveRoutePath(rootPath, menu.path))
    }
    else {
      retnPath = getDeepestPath(menu.children[0], resolveRoutePath(rootPath, menu.path))
    }
  }
  else {
    retnPath = resolveRoutePath(rootPath, menu.path)
  }
  return retnPath
}

function hasPermission(permissions: string[], menu: Menu.recordMainRaw | Menu.recordRaw) {
  let isAuth = false
  if (menu.meta && menu.meta.auth) {
    isAuth = permissions.some((auth) => {
      return typeof menu.meta?.auth === 'string'
        ? menu.meta.auth === auth
        : typeof menu.meta?.auth === 'object'
          ? menu.meta.auth.includes(auth)
          : false
    })
  }
  else {
    isAuth = true
  }
  return isAuth
}

function filterAsyncMenus<T extends Menu.recordMainRaw[] | Menu.recordRaw[]>(menus: T, permissions: string[]): T {
  const res: any = []
  menus.forEach((menu) => {
    const tmpMenu = cloneDeep(menu)
    if (hasPermission(permissions, tmpMenu)) {
      if (tmpMenu.children) {
        tmpMenu.children = filterAsyncMenus(tmpMenu.children, permissions) as Menu.recordRaw[]
        tmpMenu.children.length && res.push(tmpMenu)
      }
      else {
        res.push(tmpMenu)
      }
    }
  })
  return res
}

function getDefaultOpenedPaths(menus: Menu.recordRaw[], rootPath = '') {
  const defaultOpenedPaths: string[] = []
  menus.forEach((item) => {
    if (item.meta?.defaultOpened && item.children) {
      defaultOpenedPaths.push(resolveRoutePath(rootPath, item.path))
      const childrenDefaultOpenedPaths = getDefaultOpenedPaths(item.children, resolveRoutePath(rootPath, item.path))
      if (childrenDefaultOpenedPaths.length > 0) {
        defaultOpenedPaths.push(...childrenDefaultOpenedPaths)
      }
    }
  })
  return defaultOpenedPaths
}

const useMenuStore = defineStore(
  // ??????ID
  'menu',
  {
    state: () => ({
      menus: [{
        meta: {},
        children: [],
      }] as Menu.recordMainRaw[],
      actived: 0,
    }),
    getters: {
      // ??????????????????
      allMenus() {
        const settingsStore = useSettingsStore()
        let menus: Menu.recordMainRaw[] = [{
          meta: {},
          children: [],
        }]
        if (settingsStore.app.routeBaseOn !== 'filesystem') {
          const routeStore = useRouteStore()
          if (settingsStore.menu.menuMode === 'single') {
            menus[0].children = []
            routeStore.routes.forEach((item) => {
              menus[0].children?.push(...item.children as Menu.recordRaw[])
            })
          }
          else {
            menus = routeStore.routes as Menu.recordMainRaw[]
          }
        }
        else {
          menus = this.menus
        }
        return menus
      },
      // ???????????????
      sidebarMenus(): Menu.recordMainRaw['children'] {
        return this.allMenus.length > 0
          ? this.allMenus[this.actived].children
          : []
      },
      // ????????????????????????????????????
      sidebarMenusFirstDeepestPath(): string {
        return this.allMenus.length > 0
          ? getDeepestPath(this.sidebarMenus[0])
          : '/'
      },
      defaultOpenedPaths() {
        const settingsStore = useSettingsStore()
        let defaultOpenedPaths: string[] = []
        if (settingsStore.app.routeBaseOn !== 'filesystem') {
          defaultOpenedPaths = getDefaultOpenedPaths(this.sidebarMenus)
        }
        return defaultOpenedPaths
      },
    },
    actions: {
      // ??????????????????????????????
      async generateMenusAtFront() {
        const settingsStore = useSettingsStore()
        const userStore = useUserStore()
        let accessedMenus
        // ?????????????????????????????????????????????????????????????????????
        if (settingsStore.app.enablePermission) {
          const permissions = await userStore.getPermissions()
          accessedMenus = filterAsyncMenus(menu, permissions)
        }
        else {
          accessedMenus = cloneDeep(menu)
        }
        this.menus = accessedMenus.filter(item => item.children.length !== 0)
      },
      // ??????????????????????????????
      async generateMenusAtBack() {
        await api.get('menu/list', {
          baseURL: '/mock/',
        }).then(async (res) => {
          const settingsStore = useSettingsStore()
          const userStore = useUserStore()
          let accessedMenus: Menu.recordMainRaw[]
          // ?????????????????????????????????????????????????????????????????????
          if (settingsStore.app.enablePermission) {
            const permissions = await userStore.getPermissions()
            accessedMenus = filterAsyncMenus(res.data, permissions)
          }
          else {
            accessedMenus = cloneDeep(res.data)
          }
          this.menus = accessedMenus.filter(item => item.children.length !== 0)
        }).catch(() => {})
      },
      // ???????????????
      setActived(data: number | string) {
        if (typeof data === 'number') {
          // ????????? number ???????????????????????????????????????
          this.actived = data
        }
        else {
          // ????????? string ??????????????????????????????????????????????????????????????????
          const findIndex = this.allMenus.findIndex(item => item.children.some(r => data.indexOf(`${r.path}/`) === 0 || data === r.path))
          if (findIndex >= 0) {
            this.actived = findIndex
          }
        }
      },
    },
  },
)

export default useMenuStore
