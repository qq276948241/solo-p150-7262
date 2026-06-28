<template>
  <div class="login-container">
    <div class="login-box">
      <div class="login-header">
        <el-icon class="logo-icon"><Reading /></el-icon>
        <h1>校园自习室预约系统</h1>
        <p>Campus Study Room Reservation System</p>
      </div>

      <el-tabs v-model="activeTab" class="login-tabs">
        <el-tab-pane label="登录" name="login">
          <el-form ref="loginFormRef" :model="loginForm" :rules="loginRules" size="large">
            <el-form-item prop="username">
              <el-input v-model="loginForm.username" placeholder="用户名" :prefix-icon="User" />
            </el-form-item>
            <el-form-item prop="password">
              <el-input v-model="loginForm.password" type="password" placeholder="密码" :prefix-icon="Lock" show-password @keyup.enter="handleLogin" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" class="login-btn" @click="handleLogin" :loading="loading">
                登 录
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="注册" name="register">
          <el-form ref="registerFormRef" :model="registerForm" :rules="registerRules" size="large">
            <el-form-item prop="username">
              <el-input v-model="registerForm.username" placeholder="用户名" :prefix-icon="User" />
            </el-form-item>
            <el-form-item prop="real_name">
              <el-input v-model="registerForm.real_name" placeholder="真实姓名" :prefix-icon="UserFilled" />
            </el-form-item>
            <el-form-item prop="student_no">
              <el-input v-model="registerForm.student_no" placeholder="学号" :prefix-icon="Reading" />
            </el-form-item>
            <el-form-item prop="password">
              <el-input v-model="registerForm.password" type="password" placeholder="密码" :prefix-icon="Lock" show-password />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" class="login-btn" @click="handleRegister" :loading="loading">
                注 册
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>

      <div class="login-tips">
        <p>测试账号：admin / admin123（管理员）</p>
        <p>测试账号：student1 / 123456（学生）</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElForm } from 'element-plus'
import { User, Lock, UserFilled, Reading } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()

const activeTab = ref('login')
const loading = ref(false)
const loginFormRef = ref()
const registerFormRef = ref()

const loginForm = reactive({
  username: '',
  password: ''
})

const registerForm = reactive({
  username: '',
  real_name: '',
  student_no: '',
  password: ''
})

const loginRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

const registerRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  real_name: [{ required: true, message: '请输入真实姓名', trigger: 'blur' }],
  student_no: [{ required: true, message: '请输入学号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', min: 6, message: '密码至少6位', trigger: 'blur' }]
}

async function handleLogin() {
  if (!loginFormRef.value) return
  try {
    await loginFormRef.value.validate()
    loading.value = true
    await userStore.login(loginForm)
    ElMessage.success('登录成功')
    router.push(userStore.isAdmin ? '/admin' : '/reserve')
  } catch (e) {
    if (e.message !== '验证失败') {
      console.error(e)
    }
  } finally {
    loading.value = false
  }
}

async function handleRegister() {
  if (!registerFormRef.value) return
  try {
    await registerFormRef.value.validate()
    loading.value = true
    await userStore.register(registerForm)
    ElMessage.success('注册成功')
    router.push('/reserve')
  } catch (e) {
    if (e.message !== '验证失败') {
      console.error(e)
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-box {
  width: 420px;
  padding: 40px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
}

.login-header {
  text-align: center;
  margin-bottom: 28px;
}

.logo-icon {
  font-size: 48px;
  color: #667eea;
  margin-bottom: 12px;
}

.login-header h1 {
  font-size: 24px;
  color: #303133;
  margin-bottom: 6px;
}

.login-header p {
  font-size: 13px;
  color: #909399;
}

.login-tabs :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
}

.login-btn {
  width: 100%;
  height: 44px;
  font-size: 16px;
  letter-spacing: 4px;
}

.login-tips {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #ebeef5;
  text-align: center;
}

.login-tips p {
  font-size: 12px;
  color: #909399;
  line-height: 1.8;
}
</style>
