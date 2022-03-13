<template>
  <div class="setup">
    <div
      :style="{
        pointerEvents: getLeanCloudInfo ? 'none': 'auto',
        background: isDarkMode ? '#434348' : '#FFFFFF',
        border: isDarkMode ? '1px solid #606066' : '1px solid #F2F2F2',
      }"
      @keydown="handleKeydown"
      style='-webkit-app-region: no-drag'
      class="add-channel"
    >
      <div
        :style="{
          background: isDarkMode ? '#434348' : '#FFFFFF',
        }"
        class="input-box"
      >
        <div class="url-content">
          <div class="title-content">
            <span class="url-title">AppID</span>
          </div>
          <div
            :class="isDarkMode ? 'input-content-dark' : 'input-content-light'"
            class="input-content"
          >
            <input
              ref="inputUrl"
              v-model="appId"
              :readOnly="connected"
              placeholder="输入LeanCloud的appID"
            >
          </div>
        </div>
        <div class="url-content">
          <div class="title-content">
            <span class="url-title">AppKey</span>
          </div>
          <div
            :class="isDarkMode ? 'input-content-dark' : 'input-content-light'"
            class="input-content"
          >
            <input
              ref="inputUrl"
              v-model="appKey"
              :readOnly="connected"
              placeholder="输入LeanCloud的appKey"
            >
          </div>
        </div>
        <div class="url-content">
          <div class="title-content">
            <span class="url-title">Server</span>
          </div>
          <div
            :class="isDarkMode ? 'input-content-dark' : 'input-content-light'"
            class="input-content"
          >
            <input
              ref="inputUrl"
              v-model="server"
              :readOnly="connected"
              placeholder="输入LeanCloud的REST-API服务器地址"
            >
          </div>
        </div>
        <div class="url-content">
          <div class="title-content">
            <span v-if='getFailed' class="url-title" style='color: #ea3335'>
              房间号：请检查网络连接以及各个参数是否正确
            </span>
            <span v-if='!getFailed' class="url-title">
              房间号：创建方无需输入，点击确认会自动生成
            </span>
          </div>
          <div
            :class="isDarkMode ? 'input-content-dark' : 'input-content-light'"
            class="input-content"
          >
            <input
              ref="inputUrl"
              v-model="roomId"
              :readOnly="connected"
              placeholder="接收方输入创建方生成的房间号"
            >
          </div>
        </div>

        <div class="submit-buttons">
          <button
            @click="handleClose"
            class="cancel"
          >
            关闭
          </button>
          <button
            :style="{
              // eslint-disable-next-line max-len
              opacity: getLeanCloudInfo || isDarkMode ? 1 : (appId && appKey && server && !connected && !getLeanCloudInfo) ? '' : '0.5',
              // eslint-disable-next-line max-len
              color: !getLeanCloudInfo && isDarkMode && !(appId && appKey && server && !connected && !getLeanCloudInfo) ? 'rgba(255, 255, 255, 0.25)' : '',
              // eslint-disable-next-line max-len
              background: !getLeanCloudInfo && isDarkMode && !(appId && appKey && server && !connected && !getLeanCloudInfo) ? '#4B4B50' : '',
              // eslint-disable-next-line max-len
              border: isDarkMode ? !getLeanCloudInfo && !(appId && appKey && server && !connected && !getLeanCloudInfo)
                ? '1px solid rgba(255, 255, 255, 0)' : '' : '',
              // eslint-disable-next-line max-len
              pointerEvents: !(appId && appKey && server && !connected && !getLeanCloudInfo) ? 'none' : 'auto',
            }"
            @click="handleConnect"
            :class="(appId && appKey && server&&!connected && !getLeanCloudInfo)?'submit-hover':''"
            class="submit"
          >
            {{ getLeanCloudInfo?$t('browsing.loading'):connected?'连接成功':$t('browsing.submit') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { mapGetters } from 'vuex';
// @ts-ignore
import urlParseLax from 'url-parse-lax';
import { IMClient, Realtime } from 'leancloud-realtime/es-latest';
import electron from 'electron';
import { randomString } from '@/libs/utils';

export default {
  name: 'LeanCloudSetup',
  components: {
  },
  props: {
    showAddChannel: {
      type: Boolean,
      required: true,
    },
    initConnected: {
      type: Boolean,
      required: true,
    },
    initClient: {
      type: IMClient,
      required: true,
    },
  },
  data() {
    return {
      userId: randomString(10),
      appId: '',
      appKey: '',
      server: '', // REST API 服务器地址
      roomId: '',
      getLeanCloudInfo: false,
      getFailed: false,
      connected: this.initConnected,
      conversation: null,
      client: this.initClient,
    };
  },
  computed: {
    ...mapGetters(['bookmarkSelectedIndex', 'isDarkMode']),
    isDarwin() {
      return process.platform === 'darwin';
    },
  },
  mounted() {
    if (localStorage.appId) {
      this.appId = localStorage.appId;
    }
    if (localStorage.appKey) {
      this.appKey = localStorage.appKey;
    }
    if (localStorage.server) {
      this.server = localStorage.server;
    }
    if (localStorage.roomId) {
      this.roomId = localStorage.roomId;
    }
  },
  methods: {
    saveLCParam() {
      localStorage.appId = this.appId;
      localStorage.appKey = this.appKey;
      localStorage.server = this.server;
    },
    saveRoomId() {
      localStorage.roomId = this.roomId;
    },
    // eslint-disable-next-line complexity
    handleKeydown(e: KeyboardEvent) {
      if (e.code === 'Enter') {
        this.handleConnect();
      }
      const { remote } = electron;
      const browserWindow = remote.BrowserWindow;
      const focusWindow = (browserWindow.getFocusedWindow() as Electron.BrowserWindow);
      const CmdOrCtrl = (this.isDarwin && e.metaKey) || (this.isDarwin && e.ctrlKey);
      if (e && e.keyCode === 65 && CmdOrCtrl) { // c+a
        focusWindow.webContents.selectAll();
        e.preventDefault();
      } else if (e && e.keyCode === 67 && CmdOrCtrl) { // c+c
        focusWindow.webContents.copy();
        e.preventDefault();
      } else if (e && e.keyCode === 86 && CmdOrCtrl) { // c+v
        focusWindow.webContents.paste();
        e.preventDefault();
      } else if (e && e.keyCode === 88 && CmdOrCtrl) { // c+x
        focusWindow.webContents.cut();
        e.preventDefault();
      }
    },
    handleClose() {
      this.$emit('update:showAddChannel', false);
      this.getLeanCloudInfo = false;
      this.getFailed = false;
    },
    handleConnect() {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const that = this;
      if (that.client !== null) {
        that.client.close().catch(() => {});
        that.client = null;
      }
      this.saveLCParam();
      this.getLeanCloudInfo = true;
      const realtime = new Realtime({
        appId: this.appId,
        appKey: this.appKey,
        server: this.server,
      });
      realtime.createIMClient(this.userId).then((c) => {
        that.client = c;
        that.$emit('update:initClient', that.client);
        // 获取对话
        return c.getConversation(that.roomId);
      }).then((conversation) => {
        if (conversation) {
          that.conversation = conversation;
          that.connected = true;
          that.$emit('update:initConnected', true);
          this.saveRoomId();
          that.getLeanCloudInfo = false;
          that.$bus.$emit('lc-conversation', {
            conversation: that.conversation,
            userId: that.userId,
          });
        } else {
          // 如果服务器端不存在这个 conversation
          that.client.createConversation({
            name: 'LeanCloud-Conversation',
            // 创建暂态的聊天室（暂态聊天室支持无限人员聊天）
            transient: true,
          }).then((conversation) => {
            that.conversation = conversation;
            that.roomId = that.conversation.id;
            that.connected = true;
            that.$emit('update:initConnected', true);
            this.saveRoomId();
            that.getLeanCloudInfo = false;
            that.$bus.$emit('lc-conversation', {
              conversation: that.conversation,
              userId: that.userId,
            });
          });
        }
      }).catch((e) => {
        that.getFailed = true;
        that.getLeanCloudInfo = false;
        that.connected = false;
        that.$emit('update:initConnected', false);
      });
    },
  },
};
</script>

<style scoped lang="scss" src="@/css/darkmode/BrowsingCustomizedChannel.scss"></style>
