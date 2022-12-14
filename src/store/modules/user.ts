import useRouteStore from './route'
import useMenuStore from './menu'
import api from '@/api'

const useUserStore = defineStore(
  // 唯一ID
  'user',
  {
    state: () => ({
      account: localStorage.account || '',
      token: localStorage.token || '',
      failure_time: localStorage.failure_time || '',
      permissions: [] as string[],
    }),
    getters: {
      isLogin: (state) => {
        let retn = false
        if (state.token) {
          if (new Date().getTime() < parseInt(state.failure_time) * 1000) {
            retn = true
          }
        }
        return retn
      },
    },
    actions: {
      login(data: {
        account: string
        password: string
      }) {
        return new Promise<void>((resolve, reject) => {
          // 通过 mock 进行登录
          api.post('member/login', data, {
            baseURL: '/mock/',
          }).then((res) => {
            localStorage.setItem('account', res.data.account)
            localStorage.setItem('token', res.data.token)
            localStorage.setItem('failure_time', res.data.failure_time)
            this.account = res.data.account
            this.token = res.data.token
            this.failure_time = res.data.failure_time
            resolve()
          }).catch((error) => {
            reject(error)
          })
        })
      },
      logout() {
        return new Promise<void>((resolve) => {
          const routeStore = useRouteStore()
          const menuStore = useMenuStore()
          localStorage.removeItem('account')
          localStorage.removeItem('token')
          localStorage.removeItem('failure_time')
          this.account = ''
          this.token = ''
          this.failure_time = ''
          routeStore.removeRoutes()
          menuStore.setActived(0)
          resolve()
        })
      },
      // 获取我的权限
      async getPermissions() {
        // 通过 mock 获取权限
        const res = await api.get('member/permission', {
          baseURL: '/mock/',
          params: {
            account: this.account,
          },
        })
        this.permissions = res.data.permissions
        return this.permissions
      },
      async editPassword(data: {
        password: string
        newpassword: string
      }) {
        await api.post('member/edit/password', {
          account: this.account,
          password: data.password,
          newpassword: data.newpassword,
        }, {
          baseURL: '/mock/',
        })
      },
    },
  },
)

export default useUserStore
